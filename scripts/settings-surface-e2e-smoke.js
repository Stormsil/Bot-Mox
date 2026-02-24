#!/usr/bin/env node
const crypto = require('node:crypto');

if (typeof fetch !== 'function') {
  console.error('[settings-surface-e2e] This script requires Node.js 18+ (global fetch).');
  process.exit(1);
}

function readEnv(name, fallback = '') {
  const value = process.env[name];
  if (value === undefined || value === null) return fallback;
  return String(value).trim();
}

function readRequiredEnv(name) {
  const value = readEnv(name, '');
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
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
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let lastError = null;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      const raw = await response.text();
      let payload = null;
      if (raw) {
        try {
          payload = JSON.parse(raw);
        } catch {
          payload = null;
        }
      }
      return { status: response.status, ok: response.ok, payload, raw };
    } catch (error) {
      lastError = error;
      if (attempt >= 5) break;
      await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError || 'fetch failed'));
}

function ensureSuccess(result, expectedStatus, label) {
  const expected = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
  if (!expected.includes(result.status)) {
    throw new Error(
      `${label} failed: expected ${expected.join(' or ')}, got ${result.status}. body=${result.raw}`,
    );
  }
  if (!result.payload || result.payload.success !== true) {
    throw new Error(`${label} failed: expected success envelope`);
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
  const data = ensureSuccess(result, [200, 201], 'auth/signin');
  const token = String(data.access_token || '').trim();
  if (!token) {
    throw new Error('auth/signin returned empty access_token');
  }
  return token;
}

async function assertGet(baseUrl, token, endpoint) {
  ensureSuccess(
    await requestJson({
      baseUrl,
      method: 'GET',
      endpoint,
      token,
    }),
    200,
    `GET ${endpoint}`,
  );
}

async function assertWrite(baseUrl, token, method, endpoint, body) {
  ensureSuccess(
    await requestJson({
      baseUrl,
      method,
      endpoint,
      token,
      body,
    }),
    200,
    `${method} ${endpoint}`,
  );
}

async function run() {
  const baseUrl = normalizeBaseUrl(readEnv('API_BASE_URL', 'http://localhost'));
  const adminEmail = readRequiredEnv('BOTMOX_ADMIN_EMAIL');
  const adminPassword = readRequiredEnv('BOTMOX_ADMIN_PASSWORD');
  const runId = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  console.log(`[settings-surface-e2e] API=${baseUrl}`);

  const token = await signIn(baseUrl, adminEmail, adminPassword);

  const getEndpoints = [
    '/api/v1/settings/api_keys',
    '/api/v1/settings/proxy',
    '/api/v1/settings/notifications/events',
    '/api/v1/settings/theme',
    '/api/v1/settings/projects',
    '/api/v1/settings/ui/resource_tree',
    '/api/v1/settings/alerts',
    '/api/v1/settings/storage_policy',
    '/api/v1/settings/vmgenerator',
    '/api/v1/settings/vmgenerator/task_logs',
  ];

  for (const endpoint of getEndpoints) {
    await assertGet(baseUrl, token, endpoint);
  }

  await assertWrite(baseUrl, token, 'PUT', '/api/v1/settings/api_keys', {
    ipqs: { enabled: false },
  });
  await assertWrite(baseUrl, token, 'PUT', '/api/v1/settings/proxy', {
    auto_check_on_add: false,
  });
  await assertWrite(baseUrl, token, 'PUT', '/api/v1/settings/notifications/events', {
    daily_report: false,
  });
  await assertWrite(baseUrl, token, 'PUT', '/api/v1/settings/theme', {
    smoke_run_id: runId,
    mode: 'dark',
  });
  await assertWrite(baseUrl, token, 'PUT', '/api/v1/settings/projects/smoke-project', {
    smoke_run_id: runId,
    enabled: true,
  });
  await assertWrite(baseUrl, token, 'PATCH', '/api/v1/settings/projects', {
    smoke_patch: { run_id: runId },
  });
  await assertWrite(baseUrl, token, 'PUT', '/api/v1/settings/ui/resource_tree', {
    collapsed: false,
    smoke_run_id: runId,
  });
  await assertWrite(baseUrl, token, 'PUT', '/api/v1/settings/alerts', {
    warning_days: 7,
    smoke_run_id: runId,
  });
  await assertWrite(baseUrl, token, 'PUT', '/api/v1/settings/storage_policy', {
    retention_days: 30,
    smoke_run_id: runId,
  });
  await assertWrite(baseUrl, token, 'PUT', '/api/v1/settings/vmgenerator', {
    smoke_run_id: runId,
    template: 'default',
  });
  await assertWrite(baseUrl, token, 'PUT', '/api/v1/settings/vmgenerator/task_logs', []);

  console.log('[settings-surface-e2e] PASS');
}

run().catch((error) => {
  console.error(
    '[settings-surface-e2e] FAIL',
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
});
