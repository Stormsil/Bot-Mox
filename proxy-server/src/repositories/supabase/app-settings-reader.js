const { createSupabaseServiceClient } = require('./client');

function normalizeTenantId(input, fallback = 'default') {
  const value = String(input || '').trim();
  return value || fallback;
}

function normalizePath(pathValue) {
  const normalized = String(pathValue || '').trim().replace(/^\/+/, '').replace(/\/+$/, '');
  if (!normalized) return '';
  const segments = normalized.split('/').filter(Boolean);
  if (segments[0] === 'settings') {
    return segments.slice(1).join('/');
  }
  return segments.join('/');
}

function getNestedValue(tree, pathValue) {
  const path = normalizePath(pathValue);
  if (!path) return tree;

  const segments = path.split('/').filter(Boolean);
  let current = tree;
  for (const segment of segments) {
    if (!current || typeof current !== 'object') return null;
    current = current[segment];
  }

  return current === undefined ? null : current;
}

function createAppSettingsReader({ env }) {
  const defaultTenantId = normalizeTenantId(env?.defaultTenantId, 'default');

  function getClientResult() {
    return createSupabaseServiceClient(env);
  }

  async function readTree(tenantId) {
    const result = getClientResult();
    if (!result.ok || !result.client) {
      return null;
    }

    const targetTenantId = normalizeTenantId(tenantId, defaultTenantId);
    const { data, error } = await result.client
      .from('app_settings')
      .select('data')
      .eq('tenant_id', targetTenantId)
      .maybeSingle();

    if (error) {
      return null;
    }

    return data?.data && typeof data.data === 'object' ? data.data : {};
  }

  async function readPath(pathValue, { tenantId, fallback = null } = {}) {
    const tree = await readTree(tenantId);
    if (!tree) return fallback;

    const value = getNestedValue(tree, pathValue);
    if (value === null || value === undefined) {
      return fallback;
    }
    return value;
  }

  return {
    readTree,
    readPath,
  };
}

module.exports = {
  createAppSettingsReader,
};
