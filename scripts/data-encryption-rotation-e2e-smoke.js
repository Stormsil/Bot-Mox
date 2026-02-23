#!/usr/bin/env node
const crypto = require('node:crypto');

if (typeof fetch !== 'function') {
  console.error('[data-encryption-e2e] This script requires Node.js 18+ (global fetch).');
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
      `${label}: expected ${statuses.join(' or ')}, got ${result.status}. body=${result.raw}`,
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
  const data = ensureSuccess(result, [200, 201], `auth/signin (${login})`);
  const token = String(data.access_token || '').trim();
  const tenantId = String(data.tenant_id || '')
    .trim()
    .toLowerCase();
  if (!token) {
    throw new Error(`auth/signin (${login}) returned empty access_token`);
  }
  return { token, tenantId };
}

async function signUp(baseUrl, email, password) {
  const result = await requestJson({
    baseUrl,
    method: 'POST',
    endpoint: '/api/v1/auth/signup',
    body: { email, password },
  });
  const data = ensureSuccess(result, [200, 201], `auth/signup (${email})`);
  const token = String(data.access_token || '').trim();
  const tenantId = String(data.tenant_id || '')
    .trim()
    .toLowerCase();
  if (!token || !tenantId) {
    throw new Error(`auth/signup (${email}) returned empty access_token or tenant_id`);
  }
  return { token, tenantId };
}

async function createTenantFixtures(baseUrl, token, runId) {
  ensureSuccess(
    await requestJson({
      baseUrl,
      method: 'POST',
      endpoint: '/api/v1/workspace/notes',
      token,
      body: {
        id: `note-${runId}`,
        title: 'private note title',
        content: 'private note content',
      },
    }),
    [200, 201],
    'fixture workspace note',
  );

  ensureSuccess(
    await requestJson({
      baseUrl,
      method: 'POST',
      endpoint: '/api/v1/finance/operations',
      token,
      body: {
        id: `fin-${runId}`,
        type: 'income',
        category: 'smoke',
        amount: 12,
        currency: 'USD',
        date: Date.now(),
        description: 'private finance record',
      },
    }),
    [200, 201],
    'fixture finance operation',
  );

  ensureSuccess(
    await requestJson({
      baseUrl,
      method: 'PUT',
      endpoint: '/api/v1/settings/proxy',
      token,
      body: {
        host: `proxy-${runId}.local`,
        port: 8080,
      },
    }),
    [200, 201],
    'fixture settings proxy',
  );

  ensureSuccess(
    await requestJson({
      baseUrl,
      method: 'POST',
      endpoint: '/api/v1/resources/proxies',
      token,
      body: {
        id: `res-${runId}`,
        host: `res-${runId}.local`,
        username: 'u1',
        password: 'p1',
      },
    }),
    [200, 201],
    'fixture resource proxy',
  );

  ensureSuccess(
    await requestJson({
      baseUrl,
      method: 'POST',
      endpoint: '/api/v1/playbooks',
      token,
      body: {
        id: `pb-${runId}`,
        name: `Playbook ${runId}`,
        content: 'name: smoke\nroles:\n  - runner',
      },
    }),
    [200, 201],
    'fixture playbook',
  );

  ensureSuccess(
    await requestJson({
      baseUrl,
      method: 'POST',
      endpoint: '/api/v1/bots',
      token,
      body: {
        id: `bot-${runId}`,
        name: `bot-${runId}`,
        status: 'offline',
      },
    }),
    [200, 201],
    'fixture bot',
  );

  const profile = ensureSuccess(
    await requestJson({
      baseUrl,
      method: 'POST',
      endpoint: '/api/v1/unattend-profiles',
      token,
      body: {
        name: `profile-${runId}`,
        is_default: true,
        config: {
          locale: 'en-US',
          user: {
            displayName: 'Admin',
          },
        },
      },
    }),
    [200, 201],
    'fixture unattend profile',
  );

  ensureSuccess(
    await requestJson({
      baseUrl,
      method: 'POST',
      endpoint: '/api/v1/provisioning/generate-iso-payload',
      token,
      body: {
        profile_id: String(profile.id || ''),
        vm_uuid: `vm-${runId}`,
        ip: {
          address: '192.168.1.10',
          netmask: '255.255.255.0',
          gateway: '192.168.1.1',
          dns: ['8.8.8.8'],
        },
      },
    }),
    [200, 201],
    'fixture provisioning token',
  );

  ensureSuccess(
    await requestJson({
      baseUrl,
      method: 'PUT',
      endpoint: `/api/v1/infra/ssh/vm-config/${encodeURIComponent(`vm-${runId}`)}`,
      token,
      body: {
        content: `name: vm-${runId}\nssh_password: p-${runId}\n`,
      },
    }),
    [200, 201],
    'fixture infra vm config',
  );

  ensureSuccess(
    await requestJson({
      baseUrl,
      method: 'POST',
      endpoint: '/api/v1/vm-ops/commands',
      token,
      body: {
        agent_id: `agent-${runId}`,
        command_type: 'proxmox.list-vms',
        payload: {
          node: 'h1',
          private_token: `tok-${runId}`,
        },
      },
    }),
    [200, 201, 202],
    'fixture vm-ops command',
  );

  const themePresign = ensureSuccess(
    await requestJson({
      baseUrl,
      method: 'POST',
      endpoint: '/api/v1/theme-assets/presign-upload',
      token,
      body: {
        filename: `bg-${runId}.png`,
        mime_type: 'image/png',
        size_bytes: 2048,
      },
    }),
    [200, 201],
    'fixture theme asset presign',
  );
  ensureSuccess(
    await requestJson({
      baseUrl,
      method: 'POST',
      endpoint: '/api/v1/theme-assets/complete',
      token,
      body: {
        asset_id: String(themePresign.asset_id || ''),
        width: 1920,
        height: 1080,
      },
    }),
    [200, 201],
    'fixture theme asset complete',
  );

  ensureSuccess(
    await requestJson({
      baseUrl,
      method: 'POST',
      endpoint: '/api/v1/license/lease',
      token,
      body: {
        vm_uuid: `vm-${runId}`,
        module: 'bootstrap',
      },
    }),
    [200, 201],
    'fixture license lease',
  );

  const artifactRelease = ensureSuccess(
    await requestJson({
      baseUrl,
      method: 'POST',
      endpoint: '/api/v1/artifacts/releases',
      token,
      body: {
        module: 'core',
        platform: 'windows',
        channel: 'stable',
        version: `1.0.${Date.now()}`,
        object_key: `artifacts/core/windows/stable/${runId}.zip`,
        sha256: 'a'.repeat(64),
        size_bytes: 2048,
        status: 'active',
      },
    }),
    [200, 201],
    'fixture artifact release',
  );

  ensureSuccess(
    await requestJson({
      baseUrl,
      method: 'POST',
      endpoint: '/api/v1/artifacts/assign',
      token,
      body: {
        module: 'core',
        platform: 'windows',
        channel: 'stable',
        release_id: Number(artifactRelease.id),
      },
    }),
    [200, 201],
    'fixture artifact assignment',
  );
}

async function rotateTenantScope(baseUrl, adminToken, adminOrigin, scope, tenantId) {
  const singleResult = await requestJson({
    baseUrl,
    method: 'POST',
    endpoint: `/api/v1/admin/data-encryption/rotate-${scope}-tenant`,
    token: adminToken,
    extraHeaders: {
      Origin: adminOrigin,
      Referer: `${adminOrigin.replace(/\/+$/, '')}/`,
    },
    body: {
      tenant_id: tenantId,
      dry_run: true,
      reason: 'e2e_smoke',
    },
  });
  const singleData = ensureSuccess(singleResult, [200, 201], `rotate-${scope}-tenant`);
  if (String(singleData.scope || '').trim() !== scope) {
    throw new Error(`rotate-${scope}-tenant returned unexpected scope=${singleData.scope}`);
  }
  if (
    String(singleData.tenant_id || '')
      .trim()
      .toLowerCase() !== tenantId
  ) {
    throw new Error(`rotate-${scope}-tenant returned unexpected tenant_id=${singleData.tenant_id}`);
  }
  if (Number(singleData.planned || 0) < 1) {
    throw new Error(`rotate-${scope}-tenant planned=0, expected >=1`);
  }

  const batchResult = await requestJson({
    baseUrl,
    method: 'POST',
    endpoint: `/api/v1/admin/data-encryption/rotate-${scope}-tenants`,
    token: adminToken,
    extraHeaders: {
      Origin: adminOrigin,
      Referer: `${adminOrigin.replace(/\/+$/, '')}/`,
    },
    body: {
      tenant_ids: [tenantId],
      dry_run: true,
      reason: 'e2e_smoke',
    },
  });
  const batchData = ensureSuccess(batchResult, [200, 201], `rotate-${scope}-tenants`);
  if (String(batchData.scope || '').trim() !== scope) {
    throw new Error(`rotate-${scope}-tenants returned unexpected scope=${batchData.scope}`);
  }
  if (Number(batchData.successful_tenants || 0) !== 1) {
    throw new Error(
      `rotate-${scope}-tenants expected successful_tenants=1, got=${batchData.successful_tenants}`,
    );
  }
}

async function run() {
  const baseUrl = normalizeBaseUrl(readEnv('API_BASE_URL', 'http://localhost'));
  const adminEmail = readRequiredEnv('BOTMOX_ADMIN_EMAIL');
  const adminPassword = readRequiredEnv('BOTMOX_ADMIN_PASSWORD');
  const adminOrigin = readEnv('ADMIN_ORIGIN_ALLOWED_FOR_SMOKE', 'http://admin.localhost');

  const runId = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const userEmail = `smoke.data.enc.${runId}@example.local`;
  const userPassword = `S${crypto.randomBytes(12).toString('hex')}!9`;

  console.log(`[data-encryption-e2e] API=${baseUrl}`);

  const adminAuth = await signIn(baseUrl, adminEmail, adminPassword);
  const userAuth = await signUp(baseUrl, userEmail, userPassword);
  if (!userAuth.tenantId) {
    throw new Error('signup returned empty tenant_id');
  }

  await createTenantFixtures(baseUrl, userAuth.token, runId);

  const scopes = [
    'workspace',
    'finance',
    'settings',
    'resources',
    'playbooks',
    'bots',
    'artifacts',
    'theme',
    'license',
    'provisioning',
    'infra',
    'vmops',
  ];
  for (const scope of scopes) {
    await rotateTenantScope(baseUrl, adminAuth.token, adminOrigin, scope, userAuth.tenantId);
    console.log(`[data-encryption-e2e] scope=${scope} PASS`);
  }

  console.log('[data-encryption-e2e] PASS');
}

run().catch((error) => {
  console.error(
    '[data-encryption-e2e] FAIL',
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
});
