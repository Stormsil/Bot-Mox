#!/usr/bin/env node
const crypto = require('node:crypto');

if (typeof fetch !== 'function') {
  console.error('[admin-projects-negative-e2e] This script requires Node.js 18+ (global fetch).');
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
  if (!normalized) throw new Error('API base URL is required');
  return normalized;
}

async function requestJson({ baseUrl, method, endpoint, token, body }) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

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
  return { status: response.status, payload, raw };
}

function ensureSuccess(result, expectedStatuses, label) {
  const statuses = Array.isArray(expectedStatuses) ? expectedStatuses : [expectedStatuses];
  if (!statuses.includes(result.status)) {
    throw new Error(
      `${label} failed: expected ${statuses.join(' or ')}, got ${result.status}. body=${result.raw}`,
    );
  }
  if (!result.payload || result.payload.success !== true) {
    throw new Error(`${label} failed: expected success envelope`);
  }
  return result.payload.data;
}

function ensureError(result, expectedStatus, expectedCode, label) {
  if (result.status !== expectedStatus) {
    throw new Error(
      `${label} failed: expected status=${expectedStatus}, got=${result.status}. body=${result.raw}`,
    );
  }
  if (!result.payload || result.payload.success !== false) {
    throw new Error(`${label} failed: expected error envelope`);
  }
  const code = String(result.payload?.error?.code || '').trim();
  if (code !== expectedCode) {
    throw new Error(`${label} failed: expected code=${expectedCode}, got=${code || 'EMPTY'}`);
  }
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
  if (!token) throw new Error('auth/signin returned empty token');
  return token;
}

async function createRelease(baseUrl, token, projectKey, version) {
  const result = await requestJson({
    baseUrl,
    method: 'POST',
    endpoint: '/api/v1/admin/projects/catalog/releases',
    token,
    body: { project_key: projectKey, version, status: 'active' },
  });
  const data = ensureSuccess(result, [200, 201], 'admin/projects/catalog/releases');
  const releaseId = String(data.id || '').trim();
  if (!releaseId) throw new Error('createRelease returned empty id');
  return releaseId;
}

async function run() {
  const baseUrl = normalizeBaseUrl(readEnv('API_BASE_URL', 'http://localhost'));
  const adminEmail = readRequiredEnv('BOTMOX_ADMIN_EMAIL');
  const adminPassword = readRequiredEnv('BOTMOX_ADMIN_PASSWORD');
  const runId = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const projectA = `botmox-neg-a-${runId}`;
  const projectB = `botmox-neg-b-${runId}`;

  console.log(`[admin-projects-negative-e2e] API=${baseUrl}`);

  const adminToken = await signIn(baseUrl, adminEmail, adminPassword);
  const releaseA = await createRelease(baseUrl, adminToken, projectA, `0.0.${Date.now()}.a`);

  ensureError(
    await requestJson({
      baseUrl,
      method: 'POST',
      endpoint: '/api/v1/admin/projects/rollout',
      token: adminToken,
      body: {
        project_key: projectA,
        release_id: '11111111-1111-1111-1111-111111111111',
        scope: 'all',
      },
    }),
    404,
    'RELEASE_NOT_FOUND',
    'rollout with unknown release',
  );

  ensureError(
    await requestJson({
      baseUrl,
      method: 'POST',
      endpoint: '/api/v1/admin/projects/rollout',
      token: adminToken,
      body: {
        project_key: projectB,
        release_id: releaseA,
        scope: 'all',
      },
    }),
    400,
    'ROLLOUT_PROJECT_MISMATCH',
    'rollout project/release mismatch',
  );

  ensureError(
    await requestJson({
      baseUrl,
      method: 'POST',
      endpoint: '/api/v1/admin/projects/rollout',
      token: adminToken,
      body: {
        project_key: projectA,
        release_id: releaseA,
        scope: 'wave',
      },
    }),
    400,
    'ROLLOUT_WAVE_REQUIRED',
    'rollout wave without wave name',
  );

  ensureError(
    await requestJson({
      baseUrl,
      method: 'POST',
      endpoint: '/api/v1/admin/projects/rollback',
      token: adminToken,
      body: {
        project_key: projectA,
        scope: 'wave',
      },
    }),
    400,
    'ROLLBACK_WAVE_REQUIRED',
    'rollback wave without wave name',
  );

  ensureError(
    await requestJson({
      baseUrl,
      method: 'POST',
      endpoint: '/api/v1/admin/projects/rollout',
      token: adminToken,
      body: {
        project_key: projectA,
        release_id: releaseA,
        scope: 'tenant',
      },
    }),
    400,
    'TENANT_ID_REQUIRED',
    'rollout tenant scope without tenant_id',
  );

  console.log('[admin-projects-negative-e2e] PASS');
}

run().catch((error) => {
  console.error(
    '[admin-projects-negative-e2e] FAIL',
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
