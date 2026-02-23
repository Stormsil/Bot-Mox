#!/usr/bin/env node
const crypto = require('node:crypto');

if (typeof fetch !== 'function') {
  console.error('[load-smoke] This script requires Node.js 18+ (global fetch).');
  process.exit(1);
}

function readEnv(name, fallback = '') {
  const value = process.env[name];
  if (value === undefined || value === null) {
    return fallback;
  }
  return String(value).trim();
}

function readIntEnv(name, fallback, min, max) {
  const raw = readEnv(name, String(fallback));
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, parsed));
}

function normalizeBaseUrl(value) {
  const normalized = String(value || '')
    .trim()
    .replace(/\/+$/, '');
  if (!normalized) {
    throw new Error('API_BASE_URL is required');
  }
  return normalized;
}

function percentile(values, p) {
  if (!Array.isArray(values) || values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length) - 1;
  const index = Math.max(0, Math.min(sorted.length - 1, rank));
  return sorted[index];
}

function summarizeLatency(values) {
  if (values.length === 0) {
    return { avg_ms: 0, p95_ms: 0, p99_ms: 0, max_ms: 0 };
  }
  const total = values.reduce((acc, value) => acc + value, 0);
  return {
    avg_ms: Math.round((total / values.length) * 100) / 100,
    p95_ms: percentile(values, 95),
    p99_ms: percentile(values, 99),
    max_ms: Math.max(...values),
  };
}

async function requestWithTiming({ baseUrl, endpoint, token, timeoutMs = 15_000 }) {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    });
    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      latencyMs: Date.now() - startedAt,
      body: text,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : 'unknown_error',
      body: '',
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function probeSse({ baseUrl, token, timeoutMs = 5_000 }) {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}/api/v1/vm-ops/events?last_event_id=0`, {
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    });
    if (!response.ok || !response.body) {
      return {
        ok: false,
        status: response.status,
        latencyMs: Date.now() - startedAt,
        error: `sse_http_${response.status}`,
      };
    }

    const reader = response.body.getReader();
    let gotChunk = false;
    const readDeadline = Date.now() + timeoutMs;
    while (Date.now() < readDeadline) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (value && value.length > 0) {
        gotChunk = true;
        break;
      }
    }
    try {
      await reader.cancel();
    } catch {}

    if (!gotChunk) {
      return {
        ok: false,
        status: 200,
        latencyMs: Date.now() - startedAt,
        error: 'sse_no_chunk',
      };
    }

    return {
      ok: true,
      status: 200,
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : 'unknown_error',
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function signIn(baseUrl, login, password) {
  const result = await fetch(`${baseUrl}/api/v1/auth/signin`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ login, password }),
  });
  const payloadText = await result.text();
  if (result.status !== 200 && result.status !== 201) {
    throw new Error(`signin failed (${result.status}): ${payloadText}`);
  }
  let payload;
  try {
    payload = JSON.parse(payloadText);
  } catch {
    throw new Error('signin returned invalid JSON');
  }
  const token = String(payload?.data?.access_token || '').trim();
  if (!token) {
    throw new Error('signin returned empty access token');
  }
  return token;
}

async function createUserByAdmin(baseUrl, adminToken, index, runId, adminOrigin) {
  const email = `load.${runId}.${index}@example.local`;
  const password = `L${crypto.randomBytes(10).toString('hex')}!9`;
  const result = await fetch(`${baseUrl}/api/v1/auth/admin/create-user`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
      ...(adminOrigin ? { Origin: adminOrigin, Referer: `${adminOrigin}/` } : {}),
    },
    body: JSON.stringify({
      email,
      password,
      roles: ['user'],
    }),
  });
  const text = await result.text();
  if (result.status !== 201) {
    throw new Error(`admin/create-user failed (${result.status}): ${text}`);
  }
  return { email, password };
}

async function resolveTokens(baseUrl, userCount) {
  const providedTokens = readEnv('LOAD_USER_TOKENS', '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (providedTokens.length >= userCount) {
    return providedTokens.slice(0, userCount);
  }

  const adminEmail = readEnv('BOTMOX_ADMIN_EMAIL', '');
  const adminPassword = readEnv('BOTMOX_ADMIN_PASSWORD', '');
  const adminOrigin = readEnv('ADMIN_ORIGIN_ALLOWED_FOR_SMOKE', 'http://admin.localhost');
  if (!adminEmail || !adminPassword) {
    throw new Error(
      `Need LOAD_USER_TOKENS (${userCount} tokens) or BOTMOX_ADMIN_EMAIL + BOTMOX_ADMIN_PASSWORD`,
    );
  }

  const adminToken = await signIn(baseUrl, adminEmail, adminPassword);
  const runId = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const accounts = [];
  for (let i = 0; i < userCount; i += 1) {
    const account = await createUserByAdmin(baseUrl, adminToken, i + 1, runId, adminOrigin);
    accounts.push(account);
  }

  const tokens = [];
  for (const account of accounts) {
    const token = await signIn(baseUrl, account.email, account.password);
    tokens.push(token);
  }
  return tokens;
}

async function runWorker({ id, token, baseUrl, iterations, endpoints }) {
  const latencies = [];
  const statuses = new Map();
  const errors = new Map();
  let sseOk = 0;
  let sseFail = 0;
  const endpointStats = new Map();

  const collect = (name, status, latencyMs, errorMessage) => {
    latencies.push(latencyMs);
    statuses.set(status, (statuses.get(status) || 0) + 1);
    const prev = endpointStats.get(name) || {
      count: 0,
      latencies: [],
      statuses: new Map(),
      errors: 0,
    };
    prev.count += 1;
    prev.latencies.push(latencyMs);
    prev.statuses.set(status, (prev.statuses.get(status) || 0) + 1);
    if (errorMessage) {
      prev.errors += 1;
      errors.set(errorMessage, (errors.get(errorMessage) || 0) + 1);
    }
    endpointStats.set(name, prev);
  };

  for (let i = 0; i < iterations; i += 1) {
    const endpoint = endpoints[i % endpoints.length];
    const result = await requestWithTiming({
      baseUrl,
      endpoint: endpoint.path,
      token,
      timeoutMs: endpoint.timeoutMs,
    });
    collect(endpoint.name, result.status, result.latencyMs, result.error);

    if ((i + 1) % 5 === 0) {
      const sse = await probeSse({ baseUrl, token, timeoutMs: 4_000 });
      if (sse.ok) {
        sseOk += 1;
      } else {
        sseFail += 1;
        errors.set(
          `sse:${sse.error || sse.status}`,
          (errors.get(`sse:${sse.error || sse.status}`) || 0) + 1,
        );
      }
      latencies.push(sse.latencyMs);
    }
  }

  return { id, latencies, statuses, errors, sseOk, sseFail, endpointStats };
}

function mapToObject(map) {
  return Object.fromEntries(
    [...map.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  );
}

async function run() {
  const baseUrl = normalizeBaseUrl(readEnv('API_BASE_URL', 'http://localhost'));
  const users = readIntEnv('LOAD_USERS', 20, 1, 200);
  const iterations = readIntEnv('LOAD_ITERATIONS', 25, 1, 2_000);
  const max5xxRate = Number.parseFloat(readEnv('LOAD_MAX_5XX_RATE', '0.03'));
  const max401Rate = Number.parseFloat(readEnv('LOAD_MAX_401_RATE', '0.02'));
  const maxSseFailRate = Number.parseFloat(readEnv('LOAD_MAX_SSE_FAIL_RATE', '0.05'));
  const maxP99Ms = readIntEnv('LOAD_MAX_P99_MS', 2500, 100, 120_000);

  const endpoints = [
    { name: 'whoami', path: '/api/v1/auth/whoami', timeoutMs: 8_000 },
    { name: 'settings.theme', path: '/api/v1/settings/theme', timeoutMs: 8_000 },
    { name: 'settings.projects', path: '/api/v1/settings/projects', timeoutMs: 8_000 },
    { name: 'settings.resource_tree', path: '/api/v1/settings/ui/resource_tree', timeoutMs: 8_000 },
    {
      name: 'bots.list',
      path: '/api/v1/bots?page=1&limit=50&sort=updated_at&order=desc',
      timeoutMs: 12_000,
    },
    {
      name: 'workspace.notes',
      path: '/api/v1/workspace/notes?page=1&limit=50&sort=updated_at&order=desc',
      timeoutMs: 12_000,
    },
    {
      name: 'finance.operations',
      path: '/api/v1/finance/operations?page=1&limit=50&sort=date&order=desc',
      timeoutMs: 12_000,
    },
    {
      name: 'resources.licenses',
      path: '/api/v1/resources/licenses?page=1&limit=50&sort=updated_at&order=desc',
      timeoutMs: 12_000,
    },
  ];

  console.log(`[load-smoke] API=${baseUrl}`);
  console.log(`[load-smoke] users=${users}, iterations_per_user=${iterations}`);

  const tokens = await resolveTokens(baseUrl, users);
  if (tokens.length < users) {
    throw new Error(`Resolved only ${tokens.length} tokens, expected ${users}`);
  }

  const workers = [];
  for (let i = 0; i < users; i += 1) {
    workers.push(
      runWorker({
        id: i + 1,
        token: tokens[i],
        baseUrl,
        iterations,
        endpoints,
      }),
    );
  }

  const results = await Promise.all(workers);
  const allLatencies = [];
  const statusCounts = new Map();
  const errorCounts = new Map();
  let sseOkTotal = 0;
  let sseFailTotal = 0;
  const endpointMerged = new Map();

  for (const result of results) {
    allLatencies.push(...result.latencies);
    for (const [status, count] of result.statuses.entries()) {
      statusCounts.set(status, (statusCounts.get(status) || 0) + count);
    }
    for (const [error, count] of result.errors.entries()) {
      errorCounts.set(error, (errorCounts.get(error) || 0) + count);
    }
    sseOkTotal += result.sseOk;
    sseFailTotal += result.sseFail;
    for (const [name, entry] of result.endpointStats.entries()) {
      const prev = endpointMerged.get(name) || {
        count: 0,
        latencies: [],
        statuses: new Map(),
        errors: 0,
      };
      prev.count += entry.count;
      prev.latencies.push(...entry.latencies);
      prev.errors += entry.errors;
      for (const [status, count] of entry.statuses.entries()) {
        prev.statuses.set(status, (prev.statuses.get(status) || 0) + count);
      }
      endpointMerged.set(name, prev);
    }
  }

  const totalRequests = [...statusCounts.values()].reduce((acc, value) => acc + value, 0);
  const status401 = statusCounts.get(401) || 0;
  const status403 = statusCounts.get(403) || 0;
  const status5xx = [...statusCounts.entries()]
    .filter(([status]) => Number(status) >= 500 && Number(status) < 600)
    .reduce((acc, [, count]) => acc + count, 0);
  const sseTotal = sseOkTotal + sseFailTotal;

  const overallLatency = summarizeLatency(allLatencies);
  const report = {
    generated_at: new Date().toISOString(),
    api_base_url: baseUrl,
    users,
    iterations_per_user: iterations,
    total_requests: totalRequests,
    status_counts: mapToObject(statusCounts),
    error_counts: mapToObject(errorCounts),
    rates: {
      status_401_rate: totalRequests > 0 ? status401 / totalRequests : 0,
      status_403_rate: totalRequests > 0 ? status403 / totalRequests : 0,
      status_5xx_rate: totalRequests > 0 ? status5xx / totalRequests : 0,
      sse_fail_rate: sseTotal > 0 ? sseFailTotal / sseTotal : 0,
    },
    latency_ms: overallLatency,
    sse: {
      ok: sseOkTotal,
      failed: sseFailTotal,
      total: sseTotal,
    },
    endpoint_stats: Object.fromEntries(
      [...endpointMerged.entries()].map(([name, entry]) => [
        name,
        {
          count: entry.count,
          status_counts: mapToObject(entry.statuses),
          errors: entry.errors,
          latency_ms: summarizeLatency(entry.latencies),
        },
      ]),
    ),
  };

  console.log('[load-smoke] summary:');
  console.log(JSON.stringify(report, null, 2));

  const failedChecks = [];
  if (report.rates.status_5xx_rate > max5xxRate) {
    failedChecks.push(
      `status_5xx_rate=${report.rates.status_5xx_rate.toFixed(4)} > ${max5xxRate.toFixed(4)}`,
    );
  }
  if (report.rates.status_401_rate > max401Rate) {
    failedChecks.push(
      `status_401_rate=${report.rates.status_401_rate.toFixed(4)} > ${max401Rate.toFixed(4)}`,
    );
  }
  if (report.rates.sse_fail_rate > maxSseFailRate) {
    failedChecks.push(
      `sse_fail_rate=${report.rates.sse_fail_rate.toFixed(4)} > ${maxSseFailRate.toFixed(4)}`,
    );
  }
  if (report.latency_ms.p99_ms > maxP99Ms) {
    failedChecks.push(`p99_ms=${report.latency_ms.p99_ms} > ${maxP99Ms}`);
  }

  if (failedChecks.length > 0) {
    console.error('[load-smoke] FAIL threshold violations:');
    for (const check of failedChecks) {
      console.error(`- ${check}`);
    }
    process.exit(1);
  }

  console.log('[load-smoke] PASS');
}

run().catch((error) => {
  console.error('[load-smoke] FAIL', error instanceof Error ? error.message : error);
  process.exit(1);
});
