const { createSupabaseServiceClient } = require('./client');

class SupabaseStoragePolicyRepositoryError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'SupabaseStoragePolicyRepositoryError';
    this.status = Number(status || 500);
    this.code = String(code || 'SUPABASE_STORAGE_POLICY_ERROR');
    if (details !== undefined) {
      this.details = details;
    }
  }
}

function normalizeStoragePolicy(record) {
  const source = record && typeof record === 'object' ? record : {};
  const operational =
    String(source.operational || '')
      .trim()
      .toLowerCase() === 'local'
      ? 'local'
      : 'cloud';

  return {
    secrets: 'local-only',
    operational,
    sync: {
      enabled: Boolean(source.sync_enabled),
    },
    updated_at:
      Number.isFinite(Number(source.updated_at_ms)) && Number(source.updated_at_ms) > 0
        ? Number(source.updated_at_ms)
        : Date.now(),
    updated_by:
      typeof source.updated_by === 'string' && source.updated_by.trim()
        ? source.updated_by.trim()
        : undefined,
  };
}

function createSupabaseStoragePolicyRepository({ env }) {
  const clientResult = createSupabaseServiceClient(env);
  if (!clientResult.ok || !clientResult.client) {
    return {
      enabled: false,
      reason: clientResult.reason || 'Supabase client is not configured',
    };
  }

  const supabase = clientResult.client;
  const table = 'storage_policies';

  async function getByTenantId(tenantId) {
    const normalizedTenantId = String(tenantId || '').trim() || 'default';
    const { data, error } = await supabase
      .from(table)
      .select('tenant_id,secrets,operational,sync_enabled,updated_at_ms,updated_by')
      .eq('tenant_id', normalizedTenantId)
      .maybeSingle();

    if (error) {
      throw new SupabaseStoragePolicyRepositoryError(
        502,
        'SUPABASE_QUERY_FAILED',
        'Failed to read storage policy from Supabase',
        error.message,
      );
    }

    if (!data) return null;
    return normalizeStoragePolicy(data);
  }

  async function upsertByTenantId(tenantId, payload, actorId) {
    const normalizedTenantId = String(tenantId || '').trim() || 'default';
    const source = payload && typeof payload === 'object' ? payload : {};
    const sync = source.sync && typeof source.sync === 'object' ? source.sync : {};
    const now = Date.now();

    const row = {
      tenant_id: normalizedTenantId,
      secrets: 'local-only',
      operational:
        String(source.operational || '')
          .trim()
          .toLowerCase() === 'local'
          ? 'local'
          : 'cloud',
      sync_enabled: Boolean(sync.enabled),
      updated_at_ms: now,
      updated_by: String(actorId || source.updated_by || '').trim() || null,
    };

    const { data, error } = await supabase
      .from(table)
      .upsert(row, { onConflict: 'tenant_id' })
      .select('tenant_id,secrets,operational,sync_enabled,updated_at_ms,updated_by')
      .single();

    if (error) {
      throw new SupabaseStoragePolicyRepositoryError(
        502,
        'SUPABASE_QUERY_FAILED',
        'Failed to write storage policy to Supabase',
        error.message,
      );
    }

    return normalizeStoragePolicy(data);
  }

  return {
    enabled: true,
    getByTenantId,
    upsertByTenantId,
  };
}

module.exports = {
  createSupabaseStoragePolicyRepository,
  SupabaseStoragePolicyRepositoryError,
};
