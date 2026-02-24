#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const args = new Set(process.argv.slice(2));
const strict = args.has('--strict');

if (typeof fetch !== 'function') {
  process.stderr.write('[runtime-metrics-window] Node.js 18+ is required (global fetch).\n');
  process.exit(1);
}

const repoRoot = process.cwd();
const now = new Date();
const dateIso = now.toISOString().slice(0, 10);
const timestampIso = now.toISOString();
const monthKey = dateIso.slice(0, 7);
const reportRelPath = path.join(
  'docs',
  'audits',
  `production-hardening-runtime-metrics-${monthKey}.md`,
);
const reportAbsPath = path.join(repoRoot, reportRelPath);
const latestReportRelPath = path.join(
  'docs',
  'audits',
  'production-hardening-runtime-metrics-latest.md',
);
const latestReportAbsPath = path.join(repoRoot, latestReportRelPath);

function readEnv(name, fallback = '') {
  const value = process.env[name];
  if (value === undefined || value === null) {
    return fallback;
  }
  return String(value).trim();
}

function parseBoolean(value, fallback = false) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (!normalized) {
    return fallback;
  }
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return fallback;
}

function parseIntWithFallback(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(0, parsed);
}

function normalizeBaseUrl(value) {
  const normalized = String(value || '')
    .trim()
    .replace(/\/+$/, '');
  if (!normalized) {
    throw new Error('API base URL is required');
  }
  return normalized;
}

async function requestJson({ baseUrl, method, endpoint, token, body }) {
  const headers = {
    Accept: 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${baseUrl}${endpoint}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  return {
    status: response.status,
    ok: response.ok,
    payload,
    raw: text,
  };
}

function ensureSuccess(result, expectedStatus, label) {
  if (result.status !== expectedStatus) {
    throw new Error(
      `${label}: expected ${expectedStatus}, got ${result.status}. body=${result.raw}`,
    );
  }
  if (!result.payload || result.payload.success !== true) {
    throw new Error(`${label}: expected success envelope`);
  }
  return result.payload.data;
}

async function signIn(baseUrl, login, password) {
  const result = await requestJson({
    baseUrl,
    method: 'POST',
    endpoint: '/api/v1/auth/signin',
    body: { login, password },
  });
  const data = ensureSuccess(result, 200, 'auth/signin');
  const token = String(data.access_token || '').trim();
  if (!token) {
    throw new Error('auth/signin returned empty access token');
  }
  return token;
}

async function resolveAdminToken(baseUrl) {
  const directToken = readEnv('ADMIN_BEARER_TOKEN', '');
  if (directToken) {
    return directToken;
  }

  const adminEmail = readEnv('BOTMOX_ADMIN_EMAIL', '');
  const adminPassword = readEnv('BOTMOX_ADMIN_PASSWORD', '');
  if (!adminEmail || !adminPassword) {
    throw new Error(
      'Missing admin auth: provide ADMIN_BEARER_TOKEN or BOTMOX_ADMIN_EMAIL + BOTMOX_ADMIN_PASSWORD',
    );
  }
  return signIn(baseUrl, adminEmail, adminPassword);
}

function ensureReportFile(filePath) {
  if (fs.existsSync(filePath)) {
    return;
  }

  const initial = [
    '# Production Hardening Runtime Metrics',
    '',
    'Status: Active  ',
    'Owner: Platform Architecture  ',
    `Last Updated: ${dateIso}  `,
    'Applies To: `apps/backend`, `scripts/production-hardening-runtime-metrics-window.js`',
    '',
    '## Purpose',
    '',
    'Operational evidence log for runtime auth/http/ws/sse metrics snapshots.',
    '',
    '## Entries',
    '',
    '| Timestamp (UTC) | 401 | 403 | 5xx | SSE Opened | SSE Closed | SSE Gap | WS Opened | WS Closed | WS Gap | WS Rejected | Status | Details |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    '',
  ];

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${initial.join('\n')}\n`, 'utf8');
}

function updateLastUpdated(source) {
  if (source.includes('Last Updated:')) {
    return source.replace(/Last Updated:\s*[0-9]{4}-[0-9]{2}-[0-9]{2}/, `Last Updated: ${dateIso}`);
  }
  return source;
}

function toMetricCounter(counters, name) {
  return Number.isFinite(Number(counters?.[name])) ? Number(counters[name]) : 0;
}

function summarizeStatus(input) {
  const enforceThresholds = parseBoolean(readEnv('RUNTIME_METRICS_ENFORCE_THRESHOLDS', ''), false);
  if (!enforceThresholds) {
    return {
      status: 'pass',
      details: 'snapshot_collected; thresholds_not_enforced',
    };
  }

  const maxAuth401 = parseIntWithFallback(readEnv('RUNTIME_METRICS_MAX_AUTH_401', ''), 1000);
  const maxAuth403 = parseIntWithFallback(readEnv('RUNTIME_METRICS_MAX_AUTH_403', ''), 1000);
  const maxHttp5xx = parseIntWithFallback(readEnv('RUNTIME_METRICS_MAX_HTTP_5XX', ''), 10);
  const maxWsRejected = parseIntWithFallback(readEnv('RUNTIME_METRICS_MAX_WS_REJECTED', ''), 20);
  const maxSseGap = parseIntWithFallback(readEnv('RUNTIME_METRICS_MAX_SSE_GAP', ''), 50);
  const maxWsGap = parseIntWithFallback(readEnv('RUNTIME_METRICS_MAX_WS_GAP', ''), 50);

  const violations = [];
  if (input.auth401 > maxAuth401) violations.push(`401>${maxAuth401}`);
  if (input.auth403 > maxAuth403) violations.push(`403>${maxAuth403}`);
  if (input.http5xx > maxHttp5xx) violations.push(`5xx>${maxHttp5xx}`);
  if (input.wsRejected > maxWsRejected) violations.push(`ws_rejected>${maxWsRejected}`);
  if (input.sseGap > maxSseGap) violations.push(`sse_gap>${maxSseGap}`);
  if (input.wsGap > maxWsGap) violations.push(`ws_gap>${maxWsGap}`);

  if (violations.length > 0) {
    return {
      status: 'fail',
      details: `threshold_violation: ${violations.join(', ')}`,
    };
  }
  return {
    status: 'pass',
    details: 'thresholds_enforced; all_within_limits',
  };
}

async function run() {
  const baseUrl = normalizeBaseUrl(readEnv('API_BASE_URL', 'http://localhost'));
  const token = await resolveAdminToken(baseUrl);

  const result = await requestJson({
    baseUrl,
    method: 'GET',
    endpoint: '/api/v1/diag/runtime-metrics',
    token,
  });
  const data = ensureSuccess(result, 200, 'diag/runtime-metrics');

  const counters = data && typeof data === 'object' ? data.counters || {} : {};
  const auth401 = toMetricCounter(counters, 'auth.failures.401');
  const auth403 = toMetricCounter(counters, 'auth.failures.403');
  const http5xx = toMetricCounter(counters, 'http.failures.5xx');
  const sseOpened = toMetricCounter(counters, 'sse.opened');
  const sseClosed = toMetricCounter(counters, 'sse.closed');
  const wsOpened = toMetricCounter(counters, 'ws.opened');
  const wsClosed = toMetricCounter(counters, 'ws.closed');
  const wsRejected = toMetricCounter(counters, 'ws.rejected');
  const agentWsAssigned = toMetricCounter(counters, 'agents.ws.next_command.assigned');
  const agentWsEmpty = toMetricCounter(counters, 'agents.ws.next_command.empty');
  const agentWsAckAccepted = toMetricCounter(counters, 'agents.ws.command.ack.accepted');
  const agentWsResultAccepted = toMetricCounter(counters, 'agents.ws.command.result.accepted');
  const vmOpsSseReplay = toMetricCounter(counters, 'vmops.sse.events.replay');
  const vmOpsSseLive = toMetricCounter(counters, 'vmops.sse.events.live');
  const vmOpsSseFiltered = toMetricCounter(counters, 'vmops.sse.events.filtered_out');
  const sseGap = Math.max(0, sseOpened - sseClosed);
  const wsGap = Math.max(0, wsOpened - wsClosed);

  const statusSummary = summarizeStatus({
    auth401,
    auth403,
    http5xx,
    sseGap,
    wsGap,
    wsRejected,
  });

  ensureReportFile(reportAbsPath);
  let reportSource = fs.readFileSync(reportAbsPath, 'utf8');
  reportSource = updateLastUpdated(reportSource);
  const extraDetailsParts = [
    `agent_ws_assigned=${agentWsAssigned}`,
    `agent_ws_empty=${agentWsEmpty}`,
    `agent_ws_ack=${agentWsAckAccepted}`,
    `agent_ws_result=${agentWsResultAccepted}`,
    `vmops_sse_replay=${vmOpsSseReplay}`,
    `vmops_sse_live=${vmOpsSseLive}`,
    `vmops_sse_filtered=${vmOpsSseFiltered}`,
  ];
  const detailsWithFlow = `${statusSummary.details}; ${extraDetailsParts.join('; ')}`;
  const row = `| ${timestampIso} | ${auth401} | ${auth403} | ${http5xx} | ${sseOpened} | ${sseClosed} | ${sseGap} | ${wsOpened} | ${wsClosed} | ${wsGap} | ${wsRejected} | ${statusSummary.status} | ${detailsWithFlow} |`;
  if (!reportSource.endsWith('\n')) {
    reportSource += '\n';
  }
  reportSource += `${row}\n`;
  fs.writeFileSync(reportAbsPath, reportSource, 'utf8');
  fs.writeFileSync(latestReportAbsPath, reportSource, 'utf8');

  process.stdout.write(`Runtime-metrics entry written: ${reportRelPath}\n`);
  process.stdout.write(`Runtime-metrics latest alias updated: ${latestReportRelPath}\n`);
  process.stdout.write(`Status: ${statusSummary.status}\n`);

  if (strict && statusSummary.status === 'fail') {
    process.exit(1);
  }
}

run().catch((error) => {
  process.stderr.write(
    `[runtime-metrics-window] FAIL ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});
