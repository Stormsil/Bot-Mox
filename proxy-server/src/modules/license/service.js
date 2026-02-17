const crypto = require('crypto');
const { createSupabaseServiceClient } = require('../../repositories/supabase/client');

class LicenseServiceError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'LicenseServiceError';
    this.status = Number(status || 500);
    this.code = String(code || 'LICENSE_ERROR');
    if (details !== undefined) {
      this.details = details;
    }
  }
}

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64url(input) {
  const normalized = String(input || '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const padded = normalized + '==='.slice((normalized.length + 3) % 4);
  return Buffer.from(padded, 'base64').toString('utf8');
}

function signJwtHs256(payload, secret) {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signingInput)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  return `${signingInput}.${signature}`;
}

function verifyJwtHs256(token, secret) {
  const normalizedToken = String(token || '').trim();
  if (!normalizedToken) {
    throw new LicenseServiceError(401, 'UNAUTHORIZED', 'lease_token is required');
  }

  const parts = normalizedToken.split('.');
  if (parts.length !== 3) {
    throw new LicenseServiceError(401, 'UNAUTHORIZED', 'Invalid lease token format');
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(signingInput)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

  try {
    const expectedBuffer = Buffer.from(expectedSignature);
    const providedBuffer = Buffer.from(encodedSignature);
    const validSignature =
      expectedBuffer.length === providedBuffer.length &&
      crypto.timingSafeEqual(expectedBuffer, providedBuffer);
    if (!validSignature) {
      throw new LicenseServiceError(401, 'UNAUTHORIZED', 'Invalid lease token signature');
    }
  } catch (error) {
    if (error instanceof LicenseServiceError) {
      throw error;
    }
    throw new LicenseServiceError(401, 'UNAUTHORIZED', 'Invalid lease token signature');
  }

  let header;
  let payload;
  try {
    header = JSON.parse(fromBase64url(encodedHeader));
    payload = JSON.parse(fromBase64url(encodedPayload));
  } catch {
    throw new LicenseServiceError(401, 'UNAUTHORIZED', 'Invalid lease token payload');
  }

  if (String(header?.alg || '').toUpperCase() !== 'HS256') {
    throw new LicenseServiceError(401, 'UNAUTHORIZED', 'Unsupported lease token algorithm');
  }

  const exp = Number(payload?.exp || 0);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(exp) || exp <= nowSeconds) {
    throw new LicenseServiceError(409, 'LEASE_EXPIRED', 'Execution lease token is expired');
  }

  return payload;
}

function ensureModuleAllowed(entitlementsEntry, moduleName) {
  const normalizedModule = String(moduleName || '').trim();
  if (!normalizedModule) {
    throw new LicenseServiceError(400, 'BAD_REQUEST', 'module is required');
  }

  if (!entitlementsEntry || typeof entitlementsEntry !== 'object') {
    throw new LicenseServiceError(403, 'ENTITLEMENT_REQUIRED', 'No entitlements found for user');
  }

  const modules = entitlementsEntry.modules;
  if (Array.isArray(modules)) {
    const allowed = modules.some((entry) => String(entry || '').trim() === normalizedModule);
    if (!allowed) {
      throw new LicenseServiceError(403, 'MODULE_NOT_ALLOWED', `Module '${normalizedModule}' is not allowed`);
    }
    return;
  }

  if (modules && typeof modules === 'object') {
    const hasWildcard = modules['*'] === true;
    const allowed = modules[normalizedModule] === true;
    if (!hasWildcard && !allowed) {
      throw new LicenseServiceError(403, 'MODULE_NOT_ALLOWED', `Module '${normalizedModule}' is not allowed`);
    }
    return;
  }

  throw new LicenseServiceError(403, 'ENTITLEMENT_REQUIRED', 'No module entitlements configured');
}

function isLicenseActive(license, now) {
  if (!license || typeof license !== 'object') return false;
  const status = String(license.status || 'active').trim().toLowerCase();
  if (status !== 'active') return false;

  const type = String(license.type || '').trim().toLowerCase();
  if (type === 'perpetual' || type === 'alltime') return true;

  const expiresAt = Number(license.expires_at || license.expires_at_ms || 0);
  if (!Number.isFinite(expiresAt) || expiresAt <= 0) return false;
  return expiresAt > now;
}

function createLicenseService({ env, vmRegistryService }) {
  if (!vmRegistryService || typeof vmRegistryService.resolveVm !== 'function') {
    throw new Error('createLicenseService requires vmRegistryService');
  }

  const defaultLeaseTtlSeconds = Math.max(60, Number(env?.licenseLeaseTtlSeconds || 300));
  const signingSecret = String(env?.licenseLeaseSecret || '').trim();

  function getClient() {
    const result = createSupabaseServiceClient(env);
    if (!result.ok || !result.client) {
      throw new LicenseServiceError(503, 'SERVICE_UNAVAILABLE', 'Supabase is not configured');
    }
    return result.client;
  }

  async function ensureVmOwnership({ tenantId, userId, vmUuid }) {
    const vm = await vmRegistryService.resolveVm({ tenantId, vmUuid });
    if (!vm) {
      throw new LicenseServiceError(404, 'VM_NOT_REGISTERED', 'VM UUID is not registered');
    }
    const vmStatus = String(vm.status || 'active').trim().toLowerCase();
    if (vmStatus !== 'active') {
      throw new LicenseServiceError(403, 'VM_INACTIVE', 'VM is not active');
    }
    const vmOwner = String(vm.user_id || '').trim();
    if (vmOwner && vmOwner !== String(userId || '').trim()) {
      throw new LicenseServiceError(403, 'VM_OWNER_MISMATCH', 'VM UUID belongs to another user');
    }
    return vm;
  }

  async function ensureActiveLicense({ tenantId, userId }) {
    const client = getClient();
    const { data: rows, error } = await client
      .from('tenant_licenses')
      .select('id, user_id, type, status, expires_at_ms, metadata')
      .eq('tenant_id', String(tenantId || '').trim() || 'default');

    if (error) {
      throw new LicenseServiceError(500, 'DB_ERROR', `Failed to read licenses: ${error.message}`);
    }

    const now = Date.now();

    const candidates = (rows || [])
      .map((row) => {
        const meta = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {};
        return {
          id: row?.id,
          user_id: row?.user_id || '',
          type: row?.type || 'subscription',
          status: row?.status || 'active',
          expires_at_ms: row?.expires_at_ms || 0,
          ...meta,
        };
      })
      .filter((license) => {
        const ownerId = String(license.user_id || '').trim();
        return !ownerId || ownerId === String(userId || '').trim();
      });

    const active = candidates.find((license) => isLicenseActive(license, now));
    if (!active) {
      throw new LicenseServiceError(403, 'LICENSE_INACTIVE', 'Active subscription or perpetual license is required');
    }

    return active;
  }

  async function ensureEntitlement({ tenantId, userId, moduleName }) {
    const client = getClient();
    const normalizedTenantId = String(tenantId || '').trim() || 'default';
    const normalizedUserId = String(userId || '').trim();
    const { data, error } = await client
      .from('tenant_entitlements')
      .select('modules')
      .eq('tenant_id', normalizedTenantId)
      .eq('user_id', normalizedUserId)
      .maybeSingle();

    if (error) {
      throw new LicenseServiceError(500, 'DB_ERROR', `Failed to read entitlements: ${error.message}`);
    }

    const entry = data ? { modules: data.modules || {} } : null;
    ensureModuleAllowed(entry, moduleName);
    return entry;
  }

  async function issueExecutionLease({
    tenantId,
    userId,
    vmUuid,
    agentId,
    runnerId,
    moduleName,
    version,
  }) {
    const normalizedTenantId = String(tenantId || '').trim() || 'default';
    const normalizedUserId = String(userId || '').trim();
    const normalizedVmUuid = vmRegistryService.normalizeVmUuid(vmUuid);
    const normalizedAgentId = String(agentId || '').trim();
    const normalizedRunnerId = String(runnerId || '').trim();
    const normalizedModule = String(moduleName || '').trim();
    const normalizedVersion = String(version || '').trim();

    if (!normalizedUserId) {
      throw new LicenseServiceError(400, 'BAD_REQUEST', 'user_id is required');
    }
    if (!normalizedAgentId) {
      throw new LicenseServiceError(400, 'BAD_REQUEST', 'agent_id is required');
    }
    if (!normalizedRunnerId) {
      throw new LicenseServiceError(400, 'BAD_REQUEST', 'runner_id is required');
    }
    if (!normalizedModule) {
      throw new LicenseServiceError(400, 'BAD_REQUEST', 'module is required');
    }
    if (!signingSecret) {
      throw new LicenseServiceError(500, 'CONFIG_ERROR', 'LICENSE_LEASE_SECRET is not configured');
    }

    const [vm, license] = await Promise.all([
      ensureVmOwnership({ tenantId: normalizedTenantId, userId: normalizedUserId, vmUuid: normalizedVmUuid }),
      ensureActiveLicense({ tenantId: normalizedTenantId, userId: normalizedUserId }),
    ]);
    await ensureEntitlement({
      tenantId: normalizedTenantId,
      userId: normalizedUserId,
      moduleName: normalizedModule,
    });

    const nowSeconds = Math.floor(Date.now() / 1000);
    const ttlSeconds = defaultLeaseTtlSeconds;
    const leaseId = crypto.randomUUID();
    const payload = {
      iss: 'bot-mox-license',
      sub: normalizedRunnerId,
      jti: leaseId,
      iat: nowSeconds,
      exp: nowSeconds + ttlSeconds,
      tenant_id: normalizedTenantId,
      user_id: normalizedUserId,
      vm_uuid: normalizedVmUuid,
      agent_id: normalizedAgentId,
      module: normalizedModule,
      version: normalizedVersion || null,
      license_id: String(license.id || ''),
    };
    const token = signJwtHs256(payload, signingSecret);

    const record = {
      id: leaseId,
      tenant_id: normalizedTenantId,
      token,
      status: 'active',
      created_at_ms: Date.now(),
      updated_at_ms: Date.now(),
      expires_at_ms: (nowSeconds + ttlSeconds) * 1000,
      last_heartbeat_at_ms: Date.now(),
      user_id: normalizedUserId,
      vm_uuid: normalizedVmUuid,
      vm_name: String(vm.vm_name || ''),
      module: normalizedModule,
      version: normalizedVersion || null,
      agent_id: normalizedAgentId,
      runner_id: normalizedRunnerId,
      license_id: String(license.id || ''),
    };

    const client = getClient();
    const { error } = await client
      .from('execution_leases')
      .insert(record);

    if (error) {
      throw new LicenseServiceError(500, 'DB_ERROR', `Failed to create execution lease: ${error.message}`);
    }

    return {
      lease_id: leaseId,
      token,
      expires_at: record.expires_at_ms,
      tenant_id: normalizedTenantId,
      user_id: normalizedUserId,
      vm_uuid: normalizedVmUuid,
      module: normalizedModule,
    };
  }

  async function heartbeatLease({ tenantId, leaseId, userId }) {
    const client = getClient();
    const normalizedTenantId = String(tenantId || '').trim() || 'default';
    const normalizedLeaseId = String(leaseId || '').trim();
    if (!normalizedLeaseId) {
      throw new LicenseServiceError(400, 'BAD_REQUEST', 'lease_id is required');
    }

    const { data: lease, error: lookupError } = await client
      .from('execution_leases')
      .select('*')
      .eq('tenant_id', normalizedTenantId)
      .eq('id', normalizedLeaseId)
      .maybeSingle();

    if (lookupError) {
      throw new LicenseServiceError(500, 'DB_ERROR', `Failed to read execution lease: ${lookupError.message}`);
    }

    if (!lease) {
      throw new LicenseServiceError(404, 'LEASE_NOT_FOUND', 'Execution lease not found');
    }

    const normalizedUserId = String(userId || '').trim();
    const leaseUserId = String(lease.user_id || '').trim();
    if (leaseUserId && leaseUserId !== normalizedUserId) {
      throw new LicenseServiceError(403, 'LEASE_OWNER_MISMATCH', 'Execution lease belongs to another user');
    }

    const status = String(lease.status || 'active').trim().toLowerCase();
    if (status !== 'active') {
      throw new LicenseServiceError(409, 'LEASE_INACTIVE', 'Execution lease is not active');
    }

    const expiresAt = Number(lease.expires_at_ms || 0);
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      throw new LicenseServiceError(409, 'LEASE_EXPIRED', 'Execution lease is expired');
    }

    const patch = {
      last_heartbeat_at_ms: Date.now(),
      updated_at_ms: Date.now(),
    };
    const { error: updateError } = await client
      .from('execution_leases')
      .update(patch)
      .eq('tenant_id', normalizedTenantId)
      .eq('id', normalizedLeaseId);

    if (updateError) {
      throw new LicenseServiceError(500, 'DB_ERROR', `Failed to update execution lease heartbeat: ${updateError.message}`);
    }

    return {
      lease_id: normalizedLeaseId,
      status: 'active',
      expires_at: expiresAt,
      last_heartbeat_at: patch.last_heartbeat_at_ms,
    };
  }

  async function revokeLease({ tenantId, leaseId, actorId, reason }) {
    const client = getClient();
    const normalizedTenantId = String(tenantId || '').trim() || 'default';
    const normalizedLeaseId = String(leaseId || '').trim();
    if (!normalizedLeaseId) {
      throw new LicenseServiceError(400, 'BAD_REQUEST', 'lease_id is required');
    }

    const { data: lease, error: lookupError } = await client
      .from('execution_leases')
      .select('id, status')
      .eq('tenant_id', normalizedTenantId)
      .eq('id', normalizedLeaseId)
      .maybeSingle();

    if (lookupError) {
      throw new LicenseServiceError(500, 'DB_ERROR', `Failed to read execution lease: ${lookupError.message}`);
    }

    if (!lease) {
      throw new LicenseServiceError(404, 'LEASE_NOT_FOUND', 'Execution lease not found');
    }

    const patch = {
      status: 'revoked',
      revoked_at_ms: Date.now(),
      revoked_by: String(actorId || '').trim() || null,
      revoke_reason: String(reason || '').trim() || null,
      updated_at_ms: Date.now(),
    };
    const { error: updateError } = await client
      .from('execution_leases')
      .update(patch)
      .eq('tenant_id', normalizedTenantId)
      .eq('id', normalizedLeaseId);

    if (updateError) {
      throw new LicenseServiceError(500, 'DB_ERROR', `Failed to revoke execution lease: ${updateError.message}`);
    }

    return {
      lease_id: normalizedLeaseId,
      status: 'revoked',
      revoked_at: patch.revoked_at_ms,
    };
  }

  async function resolveActiveLeaseByToken({
    tenantId,
    token,
    expectedVmUuid,
    expectedModule,
  }) {
    const client = getClient();
    const normalizedTenantId = String(tenantId || '').trim() || 'default';
    if (!signingSecret) {
      throw new LicenseServiceError(500, 'CONFIG_ERROR', 'LICENSE_LEASE_SECRET is not configured');
    }

    const payload = verifyJwtHs256(token, signingSecret);
    const leaseId = String(payload?.jti || '').trim();
    if (!leaseId) {
      throw new LicenseServiceError(401, 'UNAUTHORIZED', 'lease_token does not contain jti');
    }

    const { data: lease, error: lookupError } = await client
      .from('execution_leases')
      .select('*')
      .eq('tenant_id', normalizedTenantId)
      .eq('id', leaseId)
      .maybeSingle();

    if (lookupError) {
      throw new LicenseServiceError(500, 'DB_ERROR', `Failed to read execution lease: ${lookupError.message}`);
    }

    if (!lease) {
      throw new LicenseServiceError(404, 'LEASE_NOT_FOUND', 'Execution lease not found');
    }

    if (lease.token && String(lease.token || '').trim() !== String(token || '').trim()) {
      throw new LicenseServiceError(401, 'UNAUTHORIZED', 'Execution lease token mismatch');
    }

    const leaseTenantId = String(lease.tenant_id || '').trim() || normalizedTenantId;
    if (leaseTenantId !== normalizedTenantId) {
      throw new LicenseServiceError(403, 'FORBIDDEN', 'Execution lease tenant mismatch');
    }

    const status = String(lease.status || 'active').trim().toLowerCase();
    if (status !== 'active') {
      throw new LicenseServiceError(409, 'LEASE_INACTIVE', 'Execution lease is not active');
    }

    const expiresAtMs = Number(lease.expires_at_ms || Number(payload.exp || 0) * 1000);
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
      throw new LicenseServiceError(409, 'LEASE_EXPIRED', 'Execution lease is expired');
    }

    const leaseVmUuid = vmRegistryService.normalizeVmUuid(lease.vm_uuid || payload.vm_uuid);
    if (expectedVmUuid) {
      const normalizedExpectedVmUuid = vmRegistryService.normalizeVmUuid(expectedVmUuid);
      if (leaseVmUuid !== normalizedExpectedVmUuid) {
        throw new LicenseServiceError(403, 'VM_UUID_MISMATCH', 'Execution lease vm_uuid mismatch');
      }
    }

    const leaseModule = String(lease.module || payload.module || '').trim();
    if (expectedModule) {
      const normalizedModule = String(expectedModule || '').trim();
      if (!leaseModule || leaseModule !== normalizedModule) {
        throw new LicenseServiceError(403, 'MODULE_MISMATCH', 'Execution lease module mismatch');
      }
    }

    return {
      lease_id: leaseId,
      lease: {
        ...lease,
        id: leaseId,
        vm_uuid: leaseVmUuid,
        module: leaseModule,
        tenant_id: leaseTenantId,
        expires_at: expiresAtMs,
      },
      token_payload: payload,
    };
  }

  return {
    issueExecutionLease,
    heartbeatLease,
    revokeLease,
    resolveActiveLeaseByToken,
  };
}

module.exports = {
  createLicenseService,
  LicenseServiceError,
};
