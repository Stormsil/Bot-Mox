const { createSupabaseServiceClient } = require('../../repositories/supabase/client');

const VM_UUID_PATTERN = /^[A-Za-z0-9:_-]{8,128}$/;

class VmRegistryServiceError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'VmRegistryServiceError';
    this.status = Number(status || 500);
    this.code = String(code || 'VM_REGISTRY_ERROR');
    if (details !== undefined) {
      this.details = details;
    }
  }
}

function normalizeVmUuid(vmUuid) {
  const normalized = String(vmUuid || '')
    .trim()
    .toLowerCase();
  if (!normalized) {
    throw new VmRegistryServiceError(400, 'BAD_REQUEST', 'vm_uuid is required');
  }
  if (!VM_UUID_PATTERN.test(normalized)) {
    throw new VmRegistryServiceError(400, 'BAD_REQUEST', 'vm_uuid has invalid format');
  }
  return normalized;
}

function createVmRegistryService({ env }) {
  function getClient() {
    const result = createSupabaseServiceClient(env);
    if (!result.ok || !result.client) {
      throw new VmRegistryServiceError(503, 'SERVICE_UNAVAILABLE', 'Supabase is not configured');
    }
    return result.client;
  }

  async function registerVm({
    tenantId,
    userId,
    vmUuid,
    vmName,
    projectId,
    status = 'active',
    metadata,
  }) {
    const normalizedVmUuid = normalizeVmUuid(vmUuid);
    const normalizedTenantId = String(tenantId || '').trim() || 'default';
    const normalizedUserId = String(userId || '').trim();
    if (!normalizedUserId) {
      throw new VmRegistryServiceError(400, 'BAD_REQUEST', 'user_id is required');
    }

    const client = getClient();
    const now = Date.now();
    const { data: existing, error: existingError } = await client
      .from('vm_registry')
      .select('created_at_ms')
      .eq('tenant_id', normalizedTenantId)
      .eq('vm_uuid', normalizedVmUuid)
      .maybeSingle();

    if (existingError) {
      throw new VmRegistryServiceError(
        500,
        'DB_ERROR',
        `Failed to read VM registry entry: ${existingError.message}`,
      );
    }

    const row = {
      tenant_id: normalizedTenantId,
      vm_uuid: normalizedVmUuid,
      user_id: normalizedUserId,
      vm_name: typeof vmName === 'string' ? vmName.trim() : '',
      project_id: typeof projectId === 'string' ? projectId.trim() : '',
      status:
        String(status || 'active')
          .trim()
          .toLowerCase() || 'active',
      metadata: metadata && typeof metadata === 'object' ? metadata : {},
      created_at_ms: Number(existing?.created_at_ms || now),
      updated_at_ms: now,
    };

    const { error } = await client
      .from('vm_registry')
      .upsert(row, { onConflict: 'tenant_id,vm_uuid' });

    if (error) {
      throw new VmRegistryServiceError(
        500,
        'DB_ERROR',
        `Failed to write VM registry entry: ${error.message}`,
      );
    }

    return {
      ...row,
      created_at: row.created_at_ms,
      updated_at: row.updated_at_ms,
    };
  }

  async function resolveVm({ tenantId, vmUuid }) {
    const normalizedVmUuid = normalizeVmUuid(vmUuid);
    const normalizedTenantId = String(tenantId || '').trim() || 'default';
    const client = getClient();

    const { data, error } = await client
      .from('vm_registry')
      .select('*')
      .eq('tenant_id', normalizedTenantId)
      .eq('vm_uuid', normalizedVmUuid)
      .maybeSingle();

    if (error) {
      throw new VmRegistryServiceError(500, 'DB_ERROR', `Failed to resolve VM: ${error.message}`);
    }

    if (!data) return null;
    return {
      ...data,
      created_at: Number(data.created_at_ms || 0),
      updated_at: Number(data.updated_at_ms || 0),
    };
  }

  return {
    registerVm,
    resolveVm,
    normalizeVmUuid,
  };
}

module.exports = {
  createVmRegistryService,
  VmRegistryServiceError,
};
