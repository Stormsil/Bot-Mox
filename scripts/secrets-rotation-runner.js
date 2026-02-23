#!/usr/bin/env node
const fs = require('node:fs/promises');
const path = require('node:path');

if (typeof fetch !== 'function') {
  console.error('[secrets-rotation] This script requires Node.js 18+ (global fetch).');
  process.exit(1);
}

function readEnv(name, fallback = '') {
  const value = process.env[name];
  if (value === undefined || value === null) {
    return fallback;
  }
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

function parseBooleanFlag(value, fallback = false) {
  const normalized = String(value ?? '')
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
      'Missing auth: provide ADMIN_BEARER_TOKEN or BOTMOX_ADMIN_EMAIL + BOTMOX_ADMIN_PASSWORD',
    );
  }
  return signIn(baseUrl, adminEmail, adminPassword);
}

async function fetchTenantIds(baseUrl, token, limit, adminOrigin) {
  const result = await requestJson({
    baseUrl,
    method: 'GET',
    endpoint: `/api/v1/admin/access/tenants?limit=${encodeURIComponent(String(limit))}`,
    token,
    extraHeaders: adminOrigin ? { Origin: adminOrigin, Referer: `${adminOrigin}/` } : undefined,
  });
  const rows = ensureSuccess(result, 200, 'admin/access/tenants');
  if (!Array.isArray(rows)) {
    throw new Error('admin/access/tenants returned non-array payload');
  }
  return Array.from(
    new Set(
      rows
        .map((row) =>
          row && typeof row === 'object'
            ? String(row.tenant_id || '')
                .trim()
                .toLowerCase()
            : '',
        )
        .filter(Boolean),
    ),
  );
}

async function rotateTenants({
  baseUrl,
  token,
  tenantIds,
  keyId,
  perTenantLimit,
  reason,
  dryRun,
  adminOrigin,
}) {
  const rotateResult = await requestJson({
    baseUrl,
    method: 'POST',
    endpoint: '/api/v1/admin/secrets/rotate-tenants',
    token,
    extraHeaders: adminOrigin ? { Origin: adminOrigin, Referer: `${adminOrigin}/` } : undefined,
    body: {
      tenant_ids: tenantIds,
      key_id: keyId,
      limit_per_tenant: perTenantLimit,
      dry_run: dryRun,
      reason,
    },
  });
  return ensureSuccess(rotateResult, 201, 'admin/secrets/rotate-tenants');
}

async function run() {
  const baseUrl = normalizeBaseUrl(readEnv('API_BASE_URL', 'http://localhost'));
  const keyId = readEnv('SECRETS_ROTATE_KEY_ID', '');
  if (!keyId) {
    throw new Error('SECRETS_ROTATE_KEY_ID is required');
  }
  const tenantLimit = Number.parseInt(readEnv('SECRETS_ROTATE_TENANTS_LIMIT', '1000'), 10);
  const perTenantLimit = Number.parseInt(readEnv('SECRETS_ROTATE_PER_TENANT_LIMIT', '1000'), 10);
  const reason = readEnv('SECRETS_ROTATE_REASON', 'scheduled_rotation');
  const dryRun = parseBooleanFlag(readEnv('SECRETS_ROTATE_DRY_RUN', ''), false);
  const requireDryRunPreflight = parseBooleanFlag(
    readEnv('SECRETS_ROTATE_REQUIRE_DRY_RUN_PREFLIGHT', ''),
    false,
  );
  const maxFailedTenants = Number.parseInt(readEnv('SECRETS_ROTATE_MAX_FAILED_TENANTS', '0'), 10);
  const maxFailedSecrets = Number.parseInt(readEnv('SECRETS_ROTATE_MAX_FAILED_SECRETS', '0'), 10);
  const reportPath = readEnv('SECRETS_ROTATE_REPORT_PATH', '');
  const adminOrigin = readEnv('ADMIN_ORIGIN_ALLOWED_FOR_SMOKE', 'http://admin.localhost');

  const normalizedTenantLimit =
    Number.isFinite(tenantLimit) && tenantLimit > 0 ? Math.min(10000, tenantLimit) : 1000;
  const normalizedPerTenantLimit =
    Number.isFinite(perTenantLimit) && perTenantLimit > 0 ? Math.min(10000, perTenantLimit) : 1000;
  const normalizedMaxFailedTenants = Number.isFinite(maxFailedTenants)
    ? Math.max(0, Math.min(10000, maxFailedTenants))
    : 0;
  const normalizedMaxFailedSecrets = Number.isFinite(maxFailedSecrets)
    ? Math.max(0, Math.min(100000, maxFailedSecrets))
    : 0;

  console.log(`[secrets-rotation] API=${baseUrl}`);
  console.log(`[secrets-rotation] key_id=${keyId}`);
  console.log(`[secrets-rotation] dry_run=${dryRun ? 'true' : 'false'}`);

  const token = await resolveAdminToken(baseUrl);
  const tenantIds = await fetchTenantIds(baseUrl, token, normalizedTenantLimit, adminOrigin);
  if (tenantIds.length === 0) {
    console.log('[secrets-rotation] no tenants found, nothing to rotate');
    return;
  }

  console.log(`[secrets-rotation] tenants=${tenantIds.length}`);
  let preflightSummary = null;
  if (!dryRun && requireDryRunPreflight) {
    console.log('[secrets-rotation] running preflight dry-run...');
    preflightSummary = await rotateTenants({
      baseUrl,
      token,
      tenantIds,
      keyId,
      perTenantLimit: normalizedPerTenantLimit,
      reason,
      dryRun: true,
      adminOrigin,
    });

    if (
      Number(preflightSummary.failed_tenants || 0) > normalizedMaxFailedTenants ||
      Number(preflightSummary.failed_total || 0) > normalizedMaxFailedSecrets
    ) {
      throw new Error(
        `preflight_failed: failed_tenants=${preflightSummary.failed_tenants}, failed_total=${preflightSummary.failed_total}, max_failed_tenants=${normalizedMaxFailedTenants}, max_failed_secrets=${normalizedMaxFailedSecrets}`,
      );
    }
  }

  const summary = await rotateTenants({
    baseUrl,
    token,
    tenantIds,
    keyId,
    perTenantLimit: normalizedPerTenantLimit,
    reason,
    dryRun,
    adminOrigin,
  });

  console.log(
    `[secrets-rotation] done: successful_tenants=${summary.successful_tenants}, failed_tenants=${summary.failed_tenants}, rotated_total=${summary.rotated_total}, skipped_total=${summary.skipped_total}, failed_total=${summary.failed_total}`,
  );

  if (reportPath) {
    const absolutePath = path.resolve(reportPath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(
      absolutePath,
      `${JSON.stringify(
        {
          generated_at: new Date().toISOString(),
          api_base_url: baseUrl,
          key_id: keyId,
          dry_run: dryRun,
          preflight_dry_run: preflightSummary,
          tenant_ids: tenantIds,
          summary,
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
    console.log(`[secrets-rotation] report_saved=${absolutePath}`);
  }
}

run().catch((error) => {
  console.error('[secrets-rotation] FAIL', error instanceof Error ? error.message : error);
  process.exit(1);
});
