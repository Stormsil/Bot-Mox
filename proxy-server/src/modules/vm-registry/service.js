const { buildTenantPath } = require('../../repositories/rtdb/tenant-paths');

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
  const normalized = String(vmUuid || '').trim().toLowerCase();
  if (!normalized) {
    throw new VmRegistryServiceError(400, 'BAD_REQUEST', 'vm_uuid is required');
  }
  if (!VM_UUID_PATTERN.test(normalized)) {
    throw new VmRegistryServiceError(400, 'BAD_REQUEST', 'vm_uuid has invalid format');
  }
  return normalized;
}

function createVmRegistryService({ admin }) {
  if (!admin || typeof admin.database !== 'function') {
    throw new Error('createVmRegistryService requires Firebase admin instance');
  }

  function vmRegistryPath(tenantId) {
    return buildTenantPath(tenantId, 'vm_registry');
  }

  function vmEntryPath(tenantId, vmUuid) {
    return `${vmRegistryPath(tenantId)}/${normalizeVmUuid(vmUuid)}`;
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

    const now = Date.now();
    const ref = admin.database().ref(vmEntryPath(normalizedTenantId, normalizedVmUuid));
    const existingSnapshot = await ref.once('value');
    const existing = existingSnapshot.val();

    const payload = {
      vm_uuid: normalizedVmUuid,
      tenant_id: normalizedTenantId,
      user_id: normalizedUserId,
      vm_name: typeof vmName === 'string' ? vmName.trim() : '',
      project_id: typeof projectId === 'string' ? projectId.trim() : '',
      status: String(status || 'active').trim().toLowerCase() || 'active',
      metadata: metadata && typeof metadata === 'object' ? metadata : {},
      created_at: Number(existing?.created_at || now),
      updated_at: now,
    };

    await ref.set(payload);
    return payload;
  }

  async function resolveVm({ tenantId, vmUuid }) {
    const normalizedVmUuid = normalizeVmUuid(vmUuid);
    const normalizedTenantId = String(tenantId || '').trim() || 'default';
    const snapshot = await admin.database().ref(vmEntryPath(normalizedTenantId, normalizedVmUuid)).once('value');
    if (!snapshot.exists()) return null;
    const value = snapshot.val();
    if (!value || typeof value !== 'object') return null;
    return {
      vm_uuid: normalizedVmUuid,
      tenant_id: normalizedTenantId,
      ...value,
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
