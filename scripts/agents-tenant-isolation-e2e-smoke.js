#!/usr/bin/env node
const crypto = require('node:crypto');

if (typeof fetch !== 'function') {
  console.error('[agents-tenant-isolation-e2e] This script requires Node.js 18+ (global fetch).');
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

let cachedAdminToken = null;

async function requestJson({ baseUrl, method, endpoint, token, body, extraHeaders }) {
  const headers = { Accept: 'application/json', ...(extraHeaders || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const requestBody = body !== undefined ? JSON.stringify(body) : undefined;

  let lastError = null;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method,
        headers,
        body: requestBody,
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
    } catch (error) {
      lastError = error;
      if (attempt >= 5) {
        break;
      }
      await sleep(300 * attempt);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError || 'fetch failed'));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

  const userA = {
    email: `smoke.agent.a.${runId}@example.local`,
    password: `Aa${crypto.randomBytes(10).toString('hex')}1`,
  };
  const userB = {
    email: `smoke.agent.b.${runId}@example.local`,
    password: `Bb${crypto.randomBytes(10).toString('hex')}1`,
  };

  console.log(`[agents-tenant-isolation-e2e] API=${baseUrl}`);
  const signedA = await signUp(baseUrl, userA.email, userA.password, adminOrigin);
  const signedB = await signUp(baseUrl, userB.email, userB.password, adminOrigin);
  if (!signedA.token || !signedB.token || !signedA.tenantId || !signedB.tenantId) {
    throw new Error('signup returned empty token/tenant');
  }
  if (signedA.tenantId === signedB.tenantId) {
    throw new Error('tenant isolation test invalid: tenant ids are equal');
  }

  const quickPairA = await requestJson({
    baseUrl,
    method: 'POST',
    endpoint: '/api/v1/agents/quick-pair',
    body: {
      login: userA.email,
      password: userA.password,
      machine_name: `machine-a-${runId}`,
      name: `agent-a-${runId}`,
      platform: 'win32',
      version: '1.0.0',
      capabilities: ['vm-ops'],
    },
  });
  const quickPairData = ensureSuccess(quickPairA, [200, 201], 'agents/quick-pair tenant A');
  const agentIdA = String(quickPairData.id || '').trim();
  if (!agentIdA) {
    throw new Error('quick-pair returned empty agent id');
  }
  console.log(
    `[agents-tenant-isolation-e2e] created agent=${agentIdA} for tenant=${signedA.tenantId}`,
  );

  ensureError(
    await requestJson({
      baseUrl,
      method: 'POST',
      endpoint: '/api/v1/agents/repair',
      token: signedB.token,
      body: {
        agent_id: agentIdA,
        reason: 'cross-tenant-repair-attempt',
      },
    }),
    404,
    'AGENT_NOT_FOUND',
    'tenant B repair tenant A agent',
  );

  ensureError(
    await requestJson({
      baseUrl,
      method: 'POST',
      endpoint: '/api/v1/agents/heartbeat',
      token: signedB.token,
      body: {
        agent_id: agentIdA,
        status: 'active',
        metadata: { source: 'cross-tenant-attempt' },
      },
    }),
    401,
    'AGENT_TOKEN_REQUIRED',
    'tenant B heartbeat tenant A agent with user token',
  );

  console.log('[agents-tenant-isolation-e2e] PASS');
}

run().catch((error) => {
  console.error(
    '[agents-tenant-isolation-e2e] FAIL',
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
