#!/usr/bin/env node
const crypto = require('node:crypto');

if (typeof fetch !== 'function') {
  console.error('[admin-projects-e2e] This script requires Node.js 18+ (global fetch).');
  process.exit(1);
}

function readEnv(name, fallback = '') {
  const value = process.env[name];
  if (value === undefined || value === null) {
    return fallback;
  }
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
  const headers = {
    Accept: 'application/json',
    ...(extraHeaders || {}),
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureSuccess(result, expectedStatus, label) {
  const expectedStatuses = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
  if (!expectedStatuses.includes(result.status)) {
    throw new Error(
      `${label} failed: expected ${expectedStatuses.join(' or ')}, got ${result.status}. body=${result.raw}`,
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

async function signUpUser(baseUrl, email, password, adminOrigin) {
  try {
    const adminTokenForCreate = await signIn(
      baseUrl,
      readRequiredEnv('BOTMOX_ADMIN_EMAIL'),
      readRequiredEnv('BOTMOX_ADMIN_PASSWORD'),
    );
    const createUserResult = await requestJson({
      baseUrl,
      method: 'POST',
      endpoint: '/api/v1/auth/admin/create-user',
      token: adminTokenForCreate,
      extraHeaders: {
        Origin: adminOrigin,
        Referer: `${adminOrigin.replace(/\/+$/, '')}/`,
      },
      body: { email, password },
    });
    if (
      createUserResult.status !== 404 ||
      String(createUserResult.payload?.error?.code || '') !== 'NOT_FOUND'
    ) {
      ensureSuccess(createUserResult, [200, 201], `auth/admin/create-user (${email})`);
      const signInResult = await requestJson({
        baseUrl,
        method: 'POST',
        endpoint: '/api/v1/auth/signin',
        body: { login: email, password },
      });
      const signInData = ensureSuccess(signInResult, [200, 201], `auth/signin (${email})`);
      const tenantId = String(signInData.tenant_id || '')
        .trim()
        .toLowerCase();
      if (!tenantId) {
        throw new Error('auth/signin returned empty tenant_id after admin create-user');
      }
      return { tenantId };
    }
  } catch {
    // Fallback to public signup path below when admin bootstrap endpoints are unavailable.
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
      const adminToken = await signIn(
        baseUrl,
        readRequiredEnv('BOTMOX_ADMIN_EMAIL'),
        readRequiredEnv('BOTMOX_ADMIN_PASSWORD'),
      );
      const createUserResult = await requestJson({
        baseUrl,
        method: 'POST',
        endpoint: '/api/v1/auth/admin/create-user',
        token: adminToken,
        extraHeaders: {
          Origin: adminOrigin,
          Referer: `${adminOrigin.replace(/\/+$/, '')}/`,
        },
        body: { email, password },
      });
      if (
        createUserResult.status !== 404 ||
        String(createUserResult.payload?.error?.code || '') !== 'NOT_FOUND'
      ) {
        ensureSuccess(createUserResult, [200, 201], `auth/admin/create-user (${email})`);
        const signInResult = await requestJson({
          baseUrl,
          method: 'POST',
          endpoint: '/api/v1/auth/signin',
          body: { login: email, password },
        });
        const signInData = ensureSuccess(signInResult, [200, 201], `auth/signin (${email})`);
        const tenantId = String(signInData.tenant_id || '')
          .trim()
          .toLowerCase();
        if (!tenantId) {
          throw new Error('auth/signin returned empty tenant_id after admin create-user fallback');
        }
        return { tenantId };
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
    const tenantId = String(data.tenant_id || '')
      .trim()
      .toLowerCase();
    if (!tenantId) {
      throw new Error('auth/signup returned empty tenant_id');
    }
    return { tenantId };
  }

  throw new Error(`auth/signup (${email}) failed after retry budget`);
}

async function createRelease(baseUrl, adminToken, projectKey, version, adminOrigin) {
  const result = await requestJson({
    baseUrl,
    method: 'POST',
    endpoint: '/api/v1/admin/projects/catalog/releases',
    token: adminToken,
    extraHeaders: { Origin: adminOrigin },
    body: {
      project_key: projectKey,
      version,
      status: 'active',
    },
  });
  const data = ensureSuccess(result, [200, 201], 'admin/projects/catalog/releases');
  const releaseId = String(data.id || '').trim();
  if (!releaseId) {
    throw new Error('create release returned empty id');
  }
  return releaseId;
}

async function rollout(baseUrl, adminToken, body, label, adminOrigin) {
  const result = await requestJson({
    baseUrl,
    method: 'POST',
    endpoint: '/api/v1/admin/projects/rollout',
    token: adminToken,
    extraHeaders: { Origin: adminOrigin },
    body,
  });
  return ensureSuccess(result, [200, 201], label);
}

async function rolloutStaged(baseUrl, adminToken, body, label, adminOrigin) {
  const result = await requestJson({
    baseUrl,
    method: 'POST',
    endpoint: '/api/v1/admin/projects/rollout/staged',
    token: adminToken,
    extraHeaders: { Origin: adminOrigin },
    body,
  });
  return ensureSuccess(result, [200, 201], label);
}

async function rollback(baseUrl, adminToken, body, label, adminOrigin) {
  const result = await requestJson({
    baseUrl,
    method: 'POST',
    endpoint: '/api/v1/admin/projects/rollback',
    token: adminToken,
    extraHeaders: { Origin: adminOrigin },
    body,
  });
  return ensureSuccess(result, [200, 201], label);
}

async function getTenantRollout(baseUrl, adminToken, projectKey, tenantId, adminOrigin) {
  const query = new URLSearchParams();
  query.set('project_key', projectKey);
  query.set('tenant_id', tenantId);
  query.set('limit', '20');
  query.set('sort', 'updated_at');
  query.set('order', 'desc');
  const result = await requestJson({
    baseUrl,
    method: 'GET',
    endpoint: `/api/v1/admin/projects/rollout/status?${query.toString()}`,
    token: adminToken,
    extraHeaders: { Origin: adminOrigin },
  });
  const data = ensureSuccess(result, 200, 'admin/projects/rollout/status');
  const items = Array.isArray(data?.items) ? data.items : [];
  return items[0] || null;
}

async function run() {
  const baseUrl = normalizeBaseUrl(readEnv('API_BASE_URL', 'http://localhost'));
  const adminEmail = readRequiredEnv('BOTMOX_ADMIN_EMAIL');
  const adminPassword = readRequiredEnv('BOTMOX_ADMIN_PASSWORD');
  const adminOrigin = readEnv('ADMIN_ORIGIN_ALLOWED_FOR_SMOKE', 'http://admin.localhost');
  const projectKey = readEnv('PROJECT_KEY', 'botmox-core');
  const runId = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  console.log(`[admin-projects-e2e] API=${baseUrl}`);
  console.log(`[admin-projects-e2e] project_key=${projectKey}`);

  const adminToken = await signIn(baseUrl, adminEmail, adminPassword);

  const user1Email = `smoke.rollout.a.${runId}@example.local`;
  const user2Email = `smoke.rollout.b.${runId}@example.local`;
  const password = `S${crypto.randomBytes(12).toString('hex')}!9`;
  const { tenantId: tenantA } = await signUpUser(baseUrl, user1Email, password, adminOrigin);
  const { tenantId: tenantB } = await signUpUser(baseUrl, user2Email, password, adminOrigin);
  console.log(`[admin-projects-e2e] tenants created: ${tenantA}, ${tenantB}`);

  const baseVersion = `0.0.${Date.now()}.base`;
  const nextVersion = `0.0.${Date.now()}.next`;
  const baseReleaseId = await createRelease(
    baseUrl,
    adminToken,
    projectKey,
    baseVersion,
    adminOrigin,
  );
  const nextReleaseId = await createRelease(
    baseUrl,
    adminToken,
    projectKey,
    nextVersion,
    adminOrigin,
  );
  console.log(
    `[admin-projects-e2e] releases created: base=${baseReleaseId} (${baseVersion}), next=${nextReleaseId} (${nextVersion})`,
  );

  await rollout(
    baseUrl,
    adminToken,
    {
      project_key: projectKey,
      release_id: baseReleaseId,
      scope: 'wave',
      wave: `smoke-base-${runId}`,
      tenant_ids: [tenantA, tenantB],
      notes: 'admin-projects-e2e baseline rollout',
    },
    'rollout baseline wave',
    adminOrigin,
  );

  const staged = await rolloutStaged(
    baseUrl,
    adminToken,
    {
      project_key: projectKey,
      release_id: nextReleaseId,
      test_tenant_id: tenantA,
      tenant_ids: [tenantA, tenantB],
      batch_size: 2,
      wave: `smoke-next-${runId}`,
      notes: 'admin-projects-e2e staged rollout',
    },
    'rollout staged',
    adminOrigin,
  );
  if (
    String(staged.canary_tenant_id || '')
      .trim()
      .toLowerCase() !== tenantA
  ) {
    throw new Error('staged rollout returned unexpected canary tenant');
  }
  if (Number(staged.total_updated || 0) < 2) {
    throw new Error(
      `staged rollout expected to update at least 2 entries, got=${staged.total_updated}`,
    );
  }

  const afterCanaryA = await getTenantRollout(
    baseUrl,
    adminToken,
    projectKey,
    tenantA,
    adminOrigin,
  );
  const afterCanaryB = await getTenantRollout(
    baseUrl,
    adminToken,
    projectKey,
    tenantB,
    adminOrigin,
  );
  if (!afterCanaryA || String(afterCanaryA.release_id || '').trim() !== nextReleaseId) {
    throw new Error('Canary tenant did not receive next release');
  }
  if (!afterCanaryB || String(afterCanaryB.release_id || '').trim() !== nextReleaseId) {
    throw new Error('Non-canary tenant did not receive next release after staged rollout');
  }
  console.log('[admin-projects-e2e] staged rollout verified');

  const afterWaveA = await getTenantRollout(baseUrl, adminToken, projectKey, tenantA, adminOrigin);
  const afterWaveB = await getTenantRollout(baseUrl, adminToken, projectKey, tenantB, adminOrigin);
  if (!afterWaveA || String(afterWaveA.release_id || '').trim() !== nextReleaseId) {
    throw new Error('Tenant A does not have next release after wave rollout');
  }
  if (!afterWaveB || String(afterWaveB.release_id || '').trim() !== nextReleaseId) {
    throw new Error('Tenant B does not have next release after wave rollout');
  }
  console.log('[admin-projects-e2e] wave stage verified');

  const rollbackResult = await rollback(
    baseUrl,
    adminToken,
    {
      project_key: projectKey,
      scope: 'tenant',
      tenant_id: tenantA,
      notes: 'admin-projects-e2e tenant rollback',
    },
    'rollback canary tenant',
    adminOrigin,
  );

  const rolledBack = Number(rollbackResult.rolled_back || 0);
  if (!Number.isFinite(rolledBack) || rolledBack < 1) {
    throw new Error(`Rollback did not affect tenant: rolled_back=${rolledBack}`);
  }

  const afterRollbackA = await getTenantRollout(
    baseUrl,
    adminToken,
    projectKey,
    tenantA,
    adminOrigin,
  );
  const afterRollbackB = await getTenantRollout(
    baseUrl,
    adminToken,
    projectKey,
    tenantB,
    adminOrigin,
  );
  if (!afterRollbackA || String(afterRollbackA.release_id || '').trim() !== baseReleaseId) {
    throw new Error('Tenant A was not rolled back to base release');
  }
  if (!afterRollbackB || String(afterRollbackB.release_id || '').trim() !== nextReleaseId) {
    throw new Error('Tenant B changed unexpectedly during tenant rollback');
  }
  console.log('[admin-projects-e2e] rollback stage verified');

  console.log('[admin-projects-e2e] PASS');
}

run().catch((error) => {
  console.error('[admin-projects-e2e] FAIL', error instanceof Error ? error.message : error);
  process.exit(1);
});
