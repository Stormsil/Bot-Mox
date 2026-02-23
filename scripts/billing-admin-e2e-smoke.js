#!/usr/bin/env node
const crypto = require('node:crypto');

if (typeof fetch !== 'function') {
  console.error('[billing-admin-e2e] This script requires Node.js 18+ (global fetch).');
  process.exit(1);
}

function readEnv(name, fallback = '') {
  const value = process.env[name];
  if (value === undefined || value === null) return fallback;
  return String(value).trim();
}

function readRequiredEnv(name) {
  const value = readEnv(name, '');
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
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

async function requestJson({ baseUrl, method, endpoint, token, body, extraHeaders }) {
  const headers = { Accept: 'application/json', ...(extraHeaders || {}) };
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function ensureErrorCodeIn(result, expectedStatus, expectedCodes, label) {
  if (result.status !== expectedStatus) {
    throw new Error(
      `${label} failed: expected status=${expectedStatus}, got=${result.status}. body=${result.raw}`,
    );
  }
  if (!result.payload || result.payload.success !== false) {
    throw new Error(`${label} failed: expected error envelope`);
  }
  const code = String(result.payload?.error?.code || '').trim();
  if (!expectedCodes.includes(code)) {
    throw new Error(
      `${label} failed: expected code in [${expectedCodes.join(', ')}], got=${code || 'EMPTY'}`,
    );
  }
}

async function signIn(baseUrl, login, password, extraHeaders) {
  const result = await requestJson({
    baseUrl,
    method: 'POST',
    endpoint: '/api/v1/auth/signin',
    extraHeaders,
    body: { login, password },
  });
  const data = ensureSuccess(result, [200, 201], 'auth/signin');
  const token = String(data.access_token || '').trim();
  if (!token) {
    throw new Error('auth/signin returned empty access token');
  }
  return token;
}

async function tryWriteSettings(baseUrl, token, payload) {
  return requestJson({
    baseUrl,
    method: 'PUT',
    endpoint: '/api/v1/settings/ui/resource_tree',
    token,
    body: payload,
  });
}

async function run() {
  const baseUrl = normalizeBaseUrl(readEnv('API_BASE_URL', 'http://localhost'));
  const adminEmail = readRequiredEnv('BOTMOX_ADMIN_EMAIL');
  const adminPassword = readRequiredEnv('BOTMOX_ADMIN_PASSWORD');
  const adminOrigin = readEnv('ADMIN_ORIGIN_ALLOWED_FOR_SMOKE', 'http://admin.localhost');
  const billingMode = readEnv('BILLING_MODE', 'stub').toLowerCase();
  if (billingMode !== 'stub') {
    throw new Error('BILLING_MODE must be stub for billing-admin smoke');
  }

  const runId = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const userEmail = `smoke.billing.${runId}@example.local`;
  const userPassword = `S${crypto.randomBytes(12).toString('hex')}!9`;

  console.log(`[billing-admin-e2e] API=${baseUrl}`);
  let signupData = null;
  try {
    const adminTokenForCreate = await signIn(baseUrl, adminEmail, adminPassword, {
      Origin: adminOrigin,
      Referer: `${adminOrigin}/`,
    });
    const createUserResult = await requestJson({
      baseUrl,
      method: 'POST',
      endpoint: '/api/v1/auth/admin/create-user',
      token: adminTokenForCreate,
      extraHeaders: { Origin: adminOrigin, Referer: `${adminOrigin}/` },
      body: { email: userEmail, password: userPassword },
    });
    if (
      createUserResult.status !== 404 ||
      String(createUserResult.payload?.error?.code || '') !== 'NOT_FOUND'
    ) {
      ensureSuccess(createUserResult, [200, 201], `auth/admin/create-user (${userEmail})`);
      const signInResult = await requestJson({
        baseUrl,
        method: 'POST',
        endpoint: '/api/v1/auth/signin',
        body: { login: userEmail, password: userPassword },
      });
      signupData = ensureSuccess(signInResult, [200, 201], `auth/signin (${userEmail})`);
    }
  } catch {
    // Continue with public signup fallback below.
  }

  if (!signupData) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const signup = await requestJson({
        baseUrl,
        method: 'POST',
        endpoint: '/api/v1/auth/signup',
        body: { email: userEmail, password: userPassword },
      });
      if (
        signup.status === 429 &&
        String(signup.payload?.error?.code || '') === 'AUTH_RATE_LIMITED'
      ) {
        const adminTokenForCreate = await signIn(baseUrl, adminEmail, adminPassword, {
          Origin: adminOrigin,
          Referer: `${adminOrigin}/`,
        });
        const createUserResult = await requestJson({
          baseUrl,
          method: 'POST',
          endpoint: '/api/v1/auth/admin/create-user',
          token: adminTokenForCreate,
          extraHeaders: { Origin: adminOrigin, Referer: `${adminOrigin}/` },
          body: { email: userEmail, password: userPassword },
        });
        if (
          createUserResult.status !== 404 ||
          String(createUserResult.payload?.error?.code || '') !== 'NOT_FOUND'
        ) {
          ensureSuccess(createUserResult, [200, 201], `auth/admin/create-user (${userEmail})`);
          const signInResult = await requestJson({
            baseUrl,
            method: 'POST',
            endpoint: '/api/v1/auth/signin',
            body: { login: userEmail, password: userPassword },
          });
          signupData = ensureSuccess(signInResult, [200, 201], `auth/signin (${userEmail})`);
          break;
        }

        const retryAfterSeconds = Number(signup.payload?.error?.retry_after_seconds ?? 1);
        const waitMs = Number.isFinite(retryAfterSeconds)
          ? Math.max(250, Math.min(3_000, Math.trunc(retryAfterSeconds * 1000)))
          : 500;
        if (attempt < 3) {
          await sleep(waitMs);
          continue;
        }
      }

      signupData = ensureSuccess(signup, [200, 201], `auth/signup (${userEmail})`);
      break;
    }
  }

  if (!signupData) {
    throw new Error(`auth/signup (${userEmail}) failed after retry budget`);
  }
  const userToken = String(signupData.access_token || '').trim();
  const tenantId = String(signupData.tenant_id || '')
    .trim()
    .toLowerCase();
  if (!userToken || !tenantId) {
    throw new Error('signup returned empty access token or tenant id');
  }

  const adminToken = await signIn(baseUrl, adminEmail, adminPassword, {
    Origin: adminOrigin,
    Referer: `${adminOrigin}/`,
  });

  const revoke = await requestJson({
    baseUrl,
    method: 'POST',
    endpoint: '/api/v1/admin/access/revoke-premium',
    token: adminToken,
    extraHeaders: { Origin: adminOrigin, Referer: `${adminOrigin}/` },
    body: { tenant_id: tenantId },
  });
  ensureSuccess(revoke, [200, 201], 'admin/access/revoke-premium');

  const writeAfterRevoke = await tryWriteSettings(baseUrl, userToken, {
    collapsed: true,
    stage: 'after_revoke',
    run_id: runId,
  });
  ensureError(writeAfterRevoke, 403, 'PREMIUM_REQUIRED', 'write blocked after revoke');

  const nonAdminMockPayment = await requestJson({
    baseUrl,
    method: 'POST',
    endpoint: '/api/v1/billing/admin/mock-payment',
    token: userToken,
    extraHeaders: { Origin: adminOrigin },
    body: { tenant_id: tenantId, days: 30 },
  });
  ensureErrorCodeIn(
    nonAdminMockPayment,
    403,
    ['AUTH_ADMIN_ROLE_REQUIRED', 'PREMIUM_REQUIRED'],
    'non-admin billing/admin/mock-payment',
  );

  const adminMockPayment = await requestJson({
    baseUrl,
    method: 'POST',
    endpoint: '/api/v1/billing/admin/mock-payment',
    token: adminToken,
    extraHeaders: { Origin: adminOrigin },
    body: { tenant_id: tenantId, days: 30, payment_ref: `smoke-${runId}` },
  });
  ensureSuccess(adminMockPayment, [200, 201], 'admin billing mock-payment');

  const writeAfterPayment = await tryWriteSettings(baseUrl, userToken, {
    collapsed: false,
    stage: 'after_payment',
    run_id: runId,
  });
  ensureSuccess(writeAfterPayment, 200, 'write allowed after admin mock-payment');

  console.log('[billing-admin-e2e] PASS');
}

run().catch((error) => {
  console.error('[billing-admin-e2e] FAIL', error instanceof Error ? error.message : error);
  process.exit(1);
});
