#!/usr/bin/env node
const crypto = require('node:crypto');

if (typeof fetch !== 'function') {
  console.error('[admin-rbac-e2e] This script requires Node.js 18+ (global fetch).');
  process.exit(1);
}

function readEnv(name, fallback = '') {
  const value = process.env[name];
  if (value === undefined || value === null) return fallback;
  return String(value).trim();
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

let cachedAdminToken = null;

async function resolveAdminToken(baseUrl, adminOrigin) {
  if (cachedAdminToken) {
    return cachedAdminToken;
  }

  const adminEmail = readEnv('BOTMOX_ADMIN_EMAIL', '');
  const adminPassword = readEnv('BOTMOX_ADMIN_PASSWORD', '');
  if (!adminEmail || !adminPassword) {
    return null;
  }

  const signIn = await requestJson({
    baseUrl,
    method: 'POST',
    endpoint: '/api/v1/auth/admin/signin',
    extraHeaders: adminOrigin ? { Origin: adminOrigin, Referer: `${adminOrigin}/` } : undefined,
    body: {
      login: adminEmail,
      password: adminPassword,
    },
  });
  if (signIn.status === 404 && String(signIn.payload?.error?.code || '') === 'NOT_FOUND') {
    return null;
  }
  const data = ensureSuccess(signIn, [200, 201], 'auth/admin/signin');
  const token = String(data.access_token || '').trim();
  if (!token) {
    throw new Error('auth/admin/signin returned empty access_token');
  }

  cachedAdminToken = token;
  return token;
}

async function signUpViaAdmin(baseUrl, email, password, adminOrigin) {
  const adminToken = await resolveAdminToken(baseUrl, adminOrigin);
  if (!adminToken) {
    return null;
  }

  const createUserResult = await requestJson({
    baseUrl,
    method: 'POST',
    endpoint: '/api/v1/auth/admin/create-user',
    token: adminToken,
    extraHeaders: adminOrigin ? { Origin: adminOrigin, Referer: `${adminOrigin}/` } : undefined,
    body: { email, password },
  });
  if (
    createUserResult.status === 404 &&
    String(createUserResult.payload?.error?.code || '') === 'NOT_FOUND'
  ) {
    return null;
  }
  ensureSuccess(createUserResult, [200, 201], `auth/admin/create-user (${email})`);

  const signIn = await requestJson({
    baseUrl,
    method: 'POST',
    endpoint: '/api/v1/auth/signin',
    body: {
      login: email,
      password,
    },
  });
  const signInData = ensureSuccess(signIn, [200, 201], `auth/signin (${email})`);
  return {
    token: String(signInData.access_token || '').trim(),
    tenantId: String(signInData.tenant_id || '')
      .trim()
      .toLowerCase(),
  };
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
  const actualCode = String(result.payload?.error?.code || '').trim();
  if (result.status === 404 && actualCode === 'NOT_FOUND') {
    throw new Error(
      `${label} failed: endpoint is missing (404 NOT_FOUND). Run strict stack rebuild to ensure latest backend routes are active.`,
    );
  }
  if (result.status !== expectedStatus) {
    throw new Error(
      `${label} failed: expected status=${expectedStatus}, got=${result.status}. body=${result.raw}`,
    );
  }
  if (!result.payload || result.payload.success !== false) {
    throw new Error(`${label} failed: expected error envelope`);
  }
  const code = actualCode;
  if (code !== expectedCode) {
    throw new Error(`${label} failed: expected code=${expectedCode}, got=${code || 'EMPTY'}`);
  }
}

async function signUp(baseUrl, email, password, adminOrigin) {
  const adminProvisioned = await signUpViaAdmin(baseUrl, email, password, adminOrigin);
  if (adminProvisioned) {
    return adminProvisioned;
  }

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const result = await requestJson({
      baseUrl,
      method: 'POST',
      endpoint: '/api/v1/auth/signup',
      body: { email, password },
    });

    if (
      result.status === 429 &&
      String(result.payload?.error?.code || '') === 'AUTH_RATE_LIMITED'
    ) {
      const fallback = await signUpViaAdmin(baseUrl, email, password, adminOrigin);
      if (fallback) {
        return fallback;
      }
      const retryAfterSeconds = Number(result.payload?.error?.retry_after_seconds ?? 1);
      const waitMs = Number.isFinite(retryAfterSeconds)
        ? Math.max(250, Math.min(3_000, Math.trunc(retryAfterSeconds * 1000)))
        : 500;
      if (attempt < 3) {
        await sleep(waitMs);
        continue;
      }
    }

    const data = ensureSuccess(result, [200, 201], `auth/signup (${email})`);
    return {
      token: String(data.access_token || '').trim(),
      tenantId: String(data.tenant_id || '')
        .trim()
        .toLowerCase(),
    };
  }

  throw new Error(
    `auth/signup (${email}) failed after retry budget. Set BOTMOX_ADMIN_EMAIL/BOTMOX_ADMIN_PASSWORD to enable admin fallback in rate-limited environments.`,
  );
}

async function run() {
  const baseUrl = normalizeBaseUrl(readEnv('API_BASE_URL', 'http://localhost'));
  const adminOrigin = readEnv('ADMIN_ORIGIN_ALLOWED_FOR_SMOKE', 'http://admin.localhost');
  const runId = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const userEmail = `smoke.admin.rbac.${runId}@example.local`;
  const userPassword = `Aa${crypto.randomBytes(10).toString('hex')}1`;

  console.log(`[admin-rbac-e2e] API=${baseUrl}`);
  const user = await signUp(baseUrl, userEmail, userPassword, adminOrigin);
  if (!user.token || !user.tenantId) {
    throw new Error('signup returned empty token/tenant');
  }

  ensureError(
    await requestJson({
      baseUrl,
      method: 'GET',
      endpoint: '/api/v1/admin/projects/catalog/releases',
      token: user.token,
      extraHeaders: { Origin: adminOrigin },
    }),
    401,
    'AUTH_ADMIN_ROLE_REQUIRED',
    'non-admin list admin project releases',
  );

  ensureError(
    await requestJson({
      baseUrl,
      method: 'GET',
      endpoint: '/api/v1/admin/access/tenants',
      token: user.token,
      extraHeaders: { Origin: adminOrigin },
    }),
    401,
    'AUTH_ADMIN_ROLE_REQUIRED',
    'non-admin list admin access tenants',
  );

  ensureError(
    await requestJson({
      baseUrl,
      method: 'POST',
      endpoint: '/api/v1/billing/admin/mock-payment',
      token: user.token,
      extraHeaders: { Origin: adminOrigin },
      body: {
        tenant_id: user.tenantId,
        days: 30,
        payment_ref: 'smoke-admin-rbac',
      },
    }),
    403,
    'AUTH_ADMIN_ROLE_REQUIRED',
    'non-admin billing admin mock-payment attempt',
  );

  ensureError(
    await requestJson({
      baseUrl,
      method: 'POST',
      endpoint: '/api/v1/admin/projects/rollout',
      token: user.token,
      extraHeaders: { Origin: adminOrigin },
      body: {
        project_key: 'botmox-core',
        release_id: '00000000-0000-0000-0000-000000000000',
        scope: 'tenant',
        tenant_id: user.tenantId,
      },
    }),
    401,
    'AUTH_ADMIN_ROLE_REQUIRED',
    'non-admin rollout attempt',
  );

  const dataEncryptionScopes = [
    'workspace',
    'finance',
    'settings',
    'resources',
    'playbooks',
    'bots',
    'provisioning',
    'infra',
    'vmops',
    'theme',
    'license',
    'artifacts',
  ];
  for (const scope of dataEncryptionScopes) {
    ensureError(
      await requestJson({
        baseUrl,
        method: 'POST',
        endpoint: `/api/v1/admin/data-encryption/rotate-${scope}-tenant`,
        token: user.token,
        extraHeaders: { Origin: adminOrigin },
        body: {
          tenant_id: user.tenantId,
          dry_run: true,
        },
      }),
      401,
      'AUTH_ADMIN_ROLE_REQUIRED',
      `non-admin rotate-${scope}-tenant attempt`,
    );

    ensureError(
      await requestJson({
        baseUrl,
        method: 'POST',
        endpoint: `/api/v1/admin/data-encryption/rotate-${scope}-tenants`,
        token: user.token,
        extraHeaders: { Origin: adminOrigin },
        body: {
          tenant_ids: [user.tenantId],
          dry_run: true,
        },
      }),
      401,
      'AUTH_ADMIN_ROLE_REQUIRED',
      `non-admin rotate-${scope}-tenants attempt`,
    );
  }

  console.log('[admin-rbac-e2e] PASS');
}

run().catch((error) => {
  console.error('[admin-rbac-e2e] FAIL', error instanceof Error ? error.message : error);
  process.exit(1);
});
