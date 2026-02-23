#!/usr/bin/env node
const fs = require('node:fs/promises');
const path = require('node:path');

if (typeof fetch !== 'function') {
  console.error('[data-encryption-rotation] This script requires Node.js 18+ (global fetch).');
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

async function rotateWorkspaceTenants({
  baseUrl,
  token,
  tenantIds,
  keyId,
  perTenantLimit,
  dryRun,
  reason,
  adminOrigin,
}) {
  const result = await requestJson({
    baseUrl,
    method: 'POST',
    endpoint: '/api/v1/admin/data-encryption/rotate-workspace-tenants',
    token,
    extraHeaders: adminOrigin ? { Origin: adminOrigin, Referer: `${adminOrigin}/` } : undefined,
    body: {
      tenant_ids: tenantIds,
      ...(keyId ? { key_id: keyId } : {}),
      limit_per_tenant: perTenantLimit,
      dry_run: dryRun,
      reason,
    },
  });
  return ensureSuccess(result, 201, 'admin/data-encryption/rotate-workspace-tenants');
}

async function rotateFinanceTenants({
  baseUrl,
  token,
  tenantIds,
  keyId,
  perTenantLimit,
  dryRun,
  reason,
  adminOrigin,
}) {
  const result = await requestJson({
    baseUrl,
    method: 'POST',
    endpoint: '/api/v1/admin/data-encryption/rotate-finance-tenants',
    token,
    extraHeaders: adminOrigin ? { Origin: adminOrigin, Referer: `${adminOrigin}/` } : undefined,
    body: {
      tenant_ids: tenantIds,
      ...(keyId ? { key_id: keyId } : {}),
      limit_per_tenant: perTenantLimit,
      dry_run: dryRun,
      reason,
    },
  });
  return ensureSuccess(result, 201, 'admin/data-encryption/rotate-finance-tenants');
}

async function rotateSettingsTenants({
  baseUrl,
  token,
  tenantIds,
  keyId,
  perTenantLimit,
  dryRun,
  reason,
  adminOrigin,
}) {
  const result = await requestJson({
    baseUrl,
    method: 'POST',
    endpoint: '/api/v1/admin/data-encryption/rotate-settings-tenants',
    token,
    extraHeaders: adminOrigin ? { Origin: adminOrigin, Referer: `${adminOrigin}/` } : undefined,
    body: {
      tenant_ids: tenantIds,
      ...(keyId ? { key_id: keyId } : {}),
      limit_per_tenant: perTenantLimit,
      dry_run: dryRun,
      reason,
    },
  });
  return ensureSuccess(result, 201, 'admin/data-encryption/rotate-settings-tenants');
}

async function rotateResourcesTenants({
  baseUrl,
  token,
  tenantIds,
  keyId,
  perTenantLimit,
  dryRun,
  reason,
  adminOrigin,
}) {
  const result = await requestJson({
    baseUrl,
    method: 'POST',
    endpoint: '/api/v1/admin/data-encryption/rotate-resources-tenants',
    token,
    extraHeaders: adminOrigin ? { Origin: adminOrigin, Referer: `${adminOrigin}/` } : undefined,
    body: {
      tenant_ids: tenantIds,
      ...(keyId ? { key_id: keyId } : {}),
      limit_per_tenant: perTenantLimit,
      dry_run: dryRun,
      reason,
    },
  });
  return ensureSuccess(result, 201, 'admin/data-encryption/rotate-resources-tenants');
}

async function rotatePlaybooksTenants({
  baseUrl,
  token,
  tenantIds,
  keyId,
  perTenantLimit,
  dryRun,
  reason,
  adminOrigin,
}) {
  const result = await requestJson({
    baseUrl,
    method: 'POST',
    endpoint: '/api/v1/admin/data-encryption/rotate-playbooks-tenants',
    token,
    extraHeaders: adminOrigin ? { Origin: adminOrigin, Referer: `${adminOrigin}/` } : undefined,
    body: {
      tenant_ids: tenantIds,
      ...(keyId ? { key_id: keyId } : {}),
      limit_per_tenant: perTenantLimit,
      dry_run: dryRun,
      reason,
    },
  });
  return ensureSuccess(result, 201, 'admin/data-encryption/rotate-playbooks-tenants');
}

async function rotateBotsTenants({
  baseUrl,
  token,
  tenantIds,
  keyId,
  perTenantLimit,
  dryRun,
  reason,
  adminOrigin,
}) {
  const result = await requestJson({
    baseUrl,
    method: 'POST',
    endpoint: '/api/v1/admin/data-encryption/rotate-bots-tenants',
    token,
    extraHeaders: adminOrigin ? { Origin: adminOrigin, Referer: `${adminOrigin}/` } : undefined,
    body: {
      tenant_ids: tenantIds,
      ...(keyId ? { key_id: keyId } : {}),
      limit_per_tenant: perTenantLimit,
      dry_run: dryRun,
      reason,
    },
  });
  return ensureSuccess(result, 201, 'admin/data-encryption/rotate-bots-tenants');
}

async function rotateProvisioningTenants({
  baseUrl,
  token,
  tenantIds,
  keyId,
  perTenantLimit,
  dryRun,
  reason,
  adminOrigin,
}) {
  const result = await requestJson({
    baseUrl,
    method: 'POST',
    endpoint: '/api/v1/admin/data-encryption/rotate-provisioning-tenants',
    token,
    extraHeaders: adminOrigin ? { Origin: adminOrigin, Referer: `${adminOrigin}/` } : undefined,
    body: {
      tenant_ids: tenantIds,
      ...(keyId ? { key_id: keyId } : {}),
      limit_per_tenant: perTenantLimit,
      dry_run: dryRun,
      reason,
    },
  });
  return ensureSuccess(result, 201, 'admin/data-encryption/rotate-provisioning-tenants');
}

async function rotateInfraTenants({
  baseUrl,
  token,
  tenantIds,
  keyId,
  perTenantLimit,
  dryRun,
  reason,
  adminOrigin,
}) {
  const result = await requestJson({
    baseUrl,
    method: 'POST',
    endpoint: '/api/v1/admin/data-encryption/rotate-infra-tenants',
    token,
    extraHeaders: adminOrigin ? { Origin: adminOrigin, Referer: `${adminOrigin}/` } : undefined,
    body: {
      tenant_ids: tenantIds,
      ...(keyId ? { key_id: keyId } : {}),
      limit_per_tenant: perTenantLimit,
      dry_run: dryRun,
      reason,
    },
  });
  return ensureSuccess(result, 201, 'admin/data-encryption/rotate-infra-tenants');
}

async function rotateVmOpsTenants({
  baseUrl,
  token,
  tenantIds,
  keyId,
  perTenantLimit,
  dryRun,
  reason,
  adminOrigin,
}) {
  const result = await requestJson({
    baseUrl,
    method: 'POST',
    endpoint: '/api/v1/admin/data-encryption/rotate-vmops-tenants',
    token,
    extraHeaders: adminOrigin ? { Origin: adminOrigin, Referer: `${adminOrigin}/` } : undefined,
    body: {
      tenant_ids: tenantIds,
      ...(keyId ? { key_id: keyId } : {}),
      limit_per_tenant: perTenantLimit,
      dry_run: dryRun,
      reason,
    },
  });
  return ensureSuccess(result, 201, 'admin/data-encryption/rotate-vmops-tenants');
}

async function rotateThemeTenants({
  baseUrl,
  token,
  tenantIds,
  keyId,
  perTenantLimit,
  dryRun,
  reason,
  adminOrigin,
}) {
  const result = await requestJson({
    baseUrl,
    method: 'POST',
    endpoint: '/api/v1/admin/data-encryption/rotate-theme-tenants',
    token,
    extraHeaders: adminOrigin ? { Origin: adminOrigin, Referer: `${adminOrigin}/` } : undefined,
    body: {
      tenant_ids: tenantIds,
      ...(keyId ? { key_id: keyId } : {}),
      limit_per_tenant: perTenantLimit,
      dry_run: dryRun,
      reason,
    },
  });
  return ensureSuccess(result, 201, 'admin/data-encryption/rotate-theme-tenants');
}

async function rotateLicenseTenants({
  baseUrl,
  token,
  tenantIds,
  keyId,
  perTenantLimit,
  dryRun,
  reason,
  adminOrigin,
}) {
  const result = await requestJson({
    baseUrl,
    method: 'POST',
    endpoint: '/api/v1/admin/data-encryption/rotate-license-tenants',
    token,
    extraHeaders: adminOrigin ? { Origin: adminOrigin, Referer: `${adminOrigin}/` } : undefined,
    body: {
      tenant_ids: tenantIds,
      ...(keyId ? { key_id: keyId } : {}),
      limit_per_tenant: perTenantLimit,
      dry_run: dryRun,
      reason,
    },
  });
  return ensureSuccess(result, 201, 'admin/data-encryption/rotate-license-tenants');
}

async function rotateArtifactsTenants({
  baseUrl,
  token,
  tenantIds,
  keyId,
  perTenantLimit,
  dryRun,
  reason,
  adminOrigin,
}) {
  const result = await requestJson({
    baseUrl,
    method: 'POST',
    endpoint: '/api/v1/admin/data-encryption/rotate-artifacts-tenants',
    token,
    extraHeaders: adminOrigin ? { Origin: adminOrigin, Referer: `${adminOrigin}/` } : undefined,
    body: {
      tenant_ids: tenantIds,
      ...(keyId ? { key_id: keyId } : {}),
      limit_per_tenant: perTenantLimit,
      dry_run: dryRun,
      reason,
    },
  });
  return ensureSuccess(result, 201, 'admin/data-encryption/rotate-artifacts-tenants');
}

function parseScope(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (!normalized || normalized === 'all') {
    return 'all';
  }
  if (
    normalized === 'workspace' ||
    normalized === 'finance' ||
    normalized === 'settings' ||
    normalized === 'resources' ||
    normalized === 'playbooks' ||
    normalized === 'bots' ||
    normalized === 'artifacts' ||
    normalized === 'theme' ||
    normalized === 'license' ||
    normalized === 'provisioning' ||
    normalized === 'infra' ||
    normalized === 'vmops'
  ) {
    return normalized;
  }
  throw new Error(`Unsupported DATA_ENCRYPTION_ROTATE_SCOPE: "${value}"`);
}

async function run() {
  const baseUrl = normalizeBaseUrl(readEnv('API_BASE_URL', 'http://localhost'));
  const keyId = readEnv('DATA_ENCRYPTION_ROTATE_KEY_ID', '');
  const tenantLimit = Number.parseInt(readEnv('DATA_ENCRYPTION_ROTATE_TENANTS_LIMIT', '1000'), 10);
  const perTenantLimit = Number.parseInt(
    readEnv('DATA_ENCRYPTION_ROTATE_PER_TENANT_LIMIT', '500'),
    10,
  );
  const reason = readEnv('DATA_ENCRYPTION_ROTATE_REASON', 'scheduled_content_rotation');
  const dryRun = parseBooleanFlag(readEnv('DATA_ENCRYPTION_ROTATE_DRY_RUN', ''), false);
  const reportPath = readEnv('DATA_ENCRYPTION_ROTATE_REPORT_PATH', '');
  const adminOrigin = readEnv('ADMIN_ORIGIN_ALLOWED_FOR_SMOKE', 'http://admin.localhost');
  const scope = parseScope(readEnv('DATA_ENCRYPTION_ROTATE_SCOPE', 'all'));

  const normalizedTenantLimit =
    Number.isFinite(tenantLimit) && tenantLimit > 0 ? Math.min(10000, tenantLimit) : 1000;
  const normalizedPerTenantLimit =
    Number.isFinite(perTenantLimit) && perTenantLimit > 0 ? Math.min(10000, perTenantLimit) : 500;

  const token = await resolveAdminToken(baseUrl);
  const tenantIds = await fetchTenantIds(baseUrl, token, normalizedTenantLimit, adminOrigin);
  if (tenantIds.length === 0) {
    console.log('[data-encryption-rotation] no tenants found, nothing to rotate');
    return;
  }

  const summaries = [];
  if (scope === 'all' || scope === 'workspace') {
    const workspaceSummary = await rotateWorkspaceTenants({
      baseUrl,
      token,
      tenantIds,
      keyId,
      perTenantLimit: normalizedPerTenantLimit,
      dryRun,
      reason,
      adminOrigin,
    });
    summaries.push({ scope: 'workspace', summary: workspaceSummary });
  }
  if (scope === 'all' || scope === 'finance') {
    const financeSummary = await rotateFinanceTenants({
      baseUrl,
      token,
      tenantIds,
      keyId,
      perTenantLimit: normalizedPerTenantLimit,
      dryRun,
      reason,
      adminOrigin,
    });
    summaries.push({ scope: 'finance', summary: financeSummary });
  }
  if (scope === 'all' || scope === 'settings') {
    const settingsSummary = await rotateSettingsTenants({
      baseUrl,
      token,
      tenantIds,
      keyId,
      perTenantLimit: normalizedPerTenantLimit,
      dryRun,
      reason,
      adminOrigin,
    });
    summaries.push({ scope: 'settings', summary: settingsSummary });
  }
  if (scope === 'all' || scope === 'resources') {
    const resourcesSummary = await rotateResourcesTenants({
      baseUrl,
      token,
      tenantIds,
      keyId,
      perTenantLimit: normalizedPerTenantLimit,
      dryRun,
      reason,
      adminOrigin,
    });
    summaries.push({ scope: 'resources', summary: resourcesSummary });
  }
  if (scope === 'all' || scope === 'playbooks') {
    const playbooksSummary = await rotatePlaybooksTenants({
      baseUrl,
      token,
      tenantIds,
      keyId,
      perTenantLimit: normalizedPerTenantLimit,
      dryRun,
      reason,
      adminOrigin,
    });
    summaries.push({ scope: 'playbooks', summary: playbooksSummary });
  }
  if (scope === 'all' || scope === 'bots') {
    const botsSummary = await rotateBotsTenants({
      baseUrl,
      token,
      tenantIds,
      keyId,
      perTenantLimit: normalizedPerTenantLimit,
      dryRun,
      reason,
      adminOrigin,
    });
    summaries.push({ scope: 'bots', summary: botsSummary });
  }
  if (scope === 'all' || scope === 'artifacts') {
    const artifactsSummary = await rotateArtifactsTenants({
      baseUrl,
      token,
      tenantIds,
      keyId,
      perTenantLimit: normalizedPerTenantLimit,
      dryRun,
      reason,
      adminOrigin,
    });
    summaries.push({ scope: 'artifacts', summary: artifactsSummary });
  }
  if (scope === 'all' || scope === 'theme') {
    const themeSummary = await rotateThemeTenants({
      baseUrl,
      token,
      tenantIds,
      keyId,
      perTenantLimit: normalizedPerTenantLimit,
      dryRun,
      reason,
      adminOrigin,
    });
    summaries.push({ scope: 'theme', summary: themeSummary });
  }
  if (scope === 'all' || scope === 'license') {
    const licenseSummary = await rotateLicenseTenants({
      baseUrl,
      token,
      tenantIds,
      keyId,
      perTenantLimit: normalizedPerTenantLimit,
      dryRun,
      reason,
      adminOrigin,
    });
    summaries.push({ scope: 'license', summary: licenseSummary });
  }
  if (scope === 'all' || scope === 'provisioning') {
    const provisioningSummary = await rotateProvisioningTenants({
      baseUrl,
      token,
      tenantIds,
      keyId,
      perTenantLimit: normalizedPerTenantLimit,
      dryRun,
      reason,
      adminOrigin,
    });
    summaries.push({ scope: 'provisioning', summary: provisioningSummary });
  }
  if (scope === 'all' || scope === 'infra') {
    const infraSummary = await rotateInfraTenants({
      baseUrl,
      token,
      tenantIds,
      keyId,
      perTenantLimit: normalizedPerTenantLimit,
      dryRun,
      reason,
      adminOrigin,
    });
    summaries.push({ scope: 'infra', summary: infraSummary });
  }
  if (scope === 'all' || scope === 'vmops') {
    const vmOpsSummary = await rotateVmOpsTenants({
      baseUrl,
      token,
      tenantIds,
      keyId,
      perTenantLimit: normalizedPerTenantLimit,
      dryRun,
      reason,
      adminOrigin,
    });
    summaries.push({ scope: 'vmops', summary: vmOpsSummary });
  }

  let failedTenantsTotal = 0;
  let failedRowsTotal = 0;
  for (const { scope: itemScope, summary } of summaries) {
    failedTenantsTotal += Number(summary.failed_tenants || 0);
    failedRowsTotal += Number(summary.failed_total || 0);
    console.log(
      `[data-encryption-rotation] done: scope=${itemScope}, successful_tenants=${summary.successful_tenants}, failed_tenants=${summary.failed_tenants}, planned_total=${summary.planned_total}, rotated_total=${summary.rotated_total}, failed_total=${summary.failed_total}`,
    );
  }

  console.log(
    `[data-encryption-rotation] aggregate: scope=${scope}, failed_tenants=${failedTenantsTotal}, failed_total=${failedRowsTotal}`,
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
          scope,
          key_id: keyId || null,
          dry_run: dryRun,
          tenant_ids: tenantIds,
          summaries,
          aggregate: {
            failed_tenants: failedTenantsTotal,
            failed_total: failedRowsTotal,
          },
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
    console.log(`[data-encryption-rotation] report_saved=${absolutePath}`);
  }
}

run().catch((error) => {
  console.error(
    '[data-encryption-rotation] FAIL',
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
});
