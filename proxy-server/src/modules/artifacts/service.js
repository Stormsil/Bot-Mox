const { createSupabaseServiceClient } = require('../../repositories/supabase/client');
const {
  createS3StorageProvider,
  S3StorageProviderError,
} = require('../../repositories/s3/storage-provider');
const { LicenseServiceError } = require('../license/service');

const RELEASE_STATUS_ACTIVE = 'active';
const AUDIT_EVENT_RESOLVE_SUCCESS = 'resolve_success';
const AUDIT_EVENT_RESOLVE_DENIED = 'resolve_denied';

class ArtifactsServiceError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ArtifactsServiceError';
    this.status = Number(status || 500);
    this.code = String(code || 'ARTIFACTS_SERVICE_ERROR');
    if (details !== undefined) {
      this.details = details;
    }
  }
}

function normalizeString(
  value,
  { field, required = true, maxLength = 200, lowercase = false } = {},
) {
  const raw = String(value || '').trim();
  if (!raw) {
    if (!required) return '';
    throw new ArtifactsServiceError(400, 'BAD_REQUEST', `${field} is required`);
  }
  if (raw.length > maxLength) {
    throw new ArtifactsServiceError(400, 'BAD_REQUEST', `${field} exceeds maximum length`);
  }
  return lowercase ? raw.toLowerCase() : raw;
}

function normalizeScope({ module, platform, channel }) {
  return {
    module: normalizeString(module, { field: 'module', maxLength: 200 }),
    platform: normalizeString(platform, { field: 'platform', maxLength: 100, lowercase: true }),
    channel: normalizeString(channel || 'stable', {
      field: 'channel',
      maxLength: 100,
      lowercase: true,
    }),
  };
}

function normalizeTenantId(tenantId) {
  return normalizeString(tenantId || 'default', { field: 'tenant_id', maxLength: 120 });
}

function normalizeUserId(userId, { required = false } = {}) {
  return normalizeString(userId, {
    field: 'user_id',
    maxLength: 200,
    required,
  });
}

function normalizeVmUuid(vmUuid) {
  const normalized = normalizeString(vmUuid, {
    field: 'vm_uuid',
    maxLength: 128,
    lowercase: true,
  });
  if (!/^[A-Za-z0-9:_-]{8,128}$/.test(normalized)) {
    throw new ArtifactsServiceError(400, 'BAD_REQUEST', 'vm_uuid has invalid format');
  }
  return normalized;
}

function normalizeSha256(value) {
  const normalized = normalizeString(value, {
    field: 'sha256',
    maxLength: 64,
    lowercase: true,
  });
  if (!/^[a-f0-9]{64}$/.test(normalized)) {
    throw new ArtifactsServiceError(400, 'BAD_REQUEST', 'sha256 must be 64 hex chars');
  }
  return normalized;
}

function toPositiveInt(value, fieldName) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new ArtifactsServiceError(400, 'BAD_REQUEST', `${fieldName} must be a positive integer`);
  }
  return parsed;
}

function normalizeReleaseStatus(value) {
  const normalized = normalizeString(value || RELEASE_STATUS_ACTIVE, {
    field: 'status',
    maxLength: 20,
    lowercase: true,
  });
  const allowed = ['draft', 'active', 'disabled', 'archived'];
  if (!allowed.includes(normalized)) {
    throw new ArtifactsServiceError(
      400,
      'BAD_REQUEST',
      'status must be one of draft|active|disabled|archived',
    );
  }
  return normalized;
}

function mapSupabaseError(error, fallbackMessage, code = 'SUPABASE_QUERY_FAILED') {
  return new ArtifactsServiceError(
    502,
    code,
    fallbackMessage,
    error?.message || String(error || 'unknown-error'),
  );
}

function normalizeAuditReason(value, fallback = 'resolve-denied') {
  const raw = String(value || fallback)
    .trim()
    .toLowerCase();
  const normalized = raw.replace(/[^a-z0-9:_-]+/g, '-').slice(0, 120);
  return normalized || fallback;
}

function mapResolveError(error) {
  if (error instanceof ArtifactsServiceError) {
    return error;
  }
  if (error instanceof LicenseServiceError) {
    return new ArtifactsServiceError(error.status, error.code, error.message, error.details);
  }
  if (error instanceof S3StorageProviderError) {
    return new ArtifactsServiceError(error.status, error.code, error.message, error.details);
  }

  return new ArtifactsServiceError(
    500,
    'ARTIFACT_RESOLVE_FAILED',
    'Failed to resolve artifact download',
    error instanceof Error ? error.message : String(error || 'unknown-error'),
  );
}

function createArtifactsService({ env, licenseService }) {
  if (!licenseService || typeof licenseService.resolveActiveLeaseByToken !== 'function') {
    throw new Error('createArtifactsService requires licenseService.resolveActiveLeaseByToken');
  }

  const supabaseResult = createSupabaseServiceClient(env);
  if (!supabaseResult.ok || !supabaseResult.client) {
    return {
      enabled: false,
      reason: `Supabase is not configured for artifacts: ${supabaseResult.reason || 'unknown reason'}`,
      code: 'SUPABASE_CONFIG_ERROR',
    };
  }

  const storageProviderResult = createS3StorageProvider({ env });
  if (!storageProviderResult.enabled || !storageProviderResult.provider) {
    return {
      enabled: false,
      reason: `S3 storage is not configured for artifacts: ${storageProviderResult.reason || 'unknown reason'}`,
      code: storageProviderResult.code || 'S3_CONFIG_ERROR',
    };
  }

  const supabase = supabaseResult.client;
  const storageProvider = storageProviderResult.provider;
  const releasesTable = 'artifact_releases';
  const assignmentsTable = 'artifact_assignments';
  const auditTable = 'artifact_download_audit';

  async function recordAudit(event) {
    const { error } = await supabase.from(auditTable).insert(event);
    if (error) {
      throw mapSupabaseError(
        error,
        'Failed to write artifact download audit',
        'ARTIFACT_AUDIT_WRITE_FAILED',
      );
    }
  }

  async function createRelease({ tenantId, actorId, payload }) {
    const normalizedTenantId = normalizeTenantId(tenantId);
    const scope = normalizeScope(payload || {});
    const row = {
      tenant_id: normalizedTenantId,
      module: scope.module,
      platform: scope.platform,
      channel: scope.channel,
      version: normalizeString(payload?.version, { field: 'version', maxLength: 100 }),
      object_key: normalizeString(payload?.object_key, { field: 'object_key', maxLength: 1024 }),
      sha256: normalizeSha256(payload?.sha256),
      size_bytes: toPositiveInt(payload?.size_bytes, 'size_bytes'),
      status: normalizeReleaseStatus(payload?.status),
      created_by: normalizeUserId(actorId, { required: false }) || null,
      updated_by: normalizeUserId(actorId, { required: false }) || null,
    };

    const { data, error } = await supabase.from(releasesTable).insert(row).select('*').single();

    if (error) {
      throw mapSupabaseError(error, 'Failed to create artifact release');
    }
    return data;
  }

  async function findReleaseById({ tenantId, releaseId }) {
    const normalizedTenantId = normalizeTenantId(tenantId);
    const { data, error } = await supabase
      .from(releasesTable)
      .select('*')
      .eq('tenant_id', normalizedTenantId)
      .eq('id', releaseId)
      .maybeSingle();
    if (error) {
      throw mapSupabaseError(error, 'Failed to read artifact release');
    }
    return data || null;
  }

  async function upsertAssignment({ tenantId, actorId, payload }) {
    const normalizedTenantId = normalizeTenantId(tenantId);
    const scope = normalizeScope(payload || {});
    const releaseId = toPositiveInt(payload?.release_id, 'release_id');
    const maybeUserId = normalizeUserId(payload?.user_id, { required: false }) || null;
    const normalizedActorId = normalizeUserId(actorId, { required: false }) || null;

    const release = await findReleaseById({
      tenantId: normalizedTenantId,
      releaseId,
    });
    if (!release) {
      throw new ArtifactsServiceError(404, 'NOT_FOUND', 'artifact release not found');
    }

    if (
      String(release.module || '') !== scope.module ||
      String(release.platform || '').toLowerCase() !== scope.platform ||
      String(release.channel || '').toLowerCase() !== scope.channel
    ) {
      throw new ArtifactsServiceError(
        409,
        'ARTIFACT_SCOPE_MISMATCH',
        'release scope does not match assignment scope',
      );
    }

    const deleteQuery = supabase
      .from(assignmentsTable)
      .delete()
      .eq('tenant_id', normalizedTenantId)
      .eq('module', scope.module)
      .eq('platform', scope.platform)
      .eq('channel', scope.channel);

    let deleteResult;
    if (maybeUserId) {
      deleteResult = await deleteQuery.eq('user_id', maybeUserId);
    } else {
      deleteResult = await deleteQuery.is('user_id', null);
    }

    if (deleteResult.error) {
      throw mapSupabaseError(deleteResult.error, 'Failed to clear previous artifact assignment');
    }

    const row = {
      tenant_id: normalizedTenantId,
      module: scope.module,
      platform: scope.platform,
      channel: scope.channel,
      user_id: maybeUserId,
      release_id: releaseId,
      is_default: !maybeUserId,
      created_by: normalizedActorId,
      updated_by: normalizedActorId,
    };

    const { data, error } = await supabase.from(assignmentsTable).insert(row).select('*').single();

    if (error) {
      throw mapSupabaseError(error, 'Failed to create artifact assignment');
    }
    return data;
  }

  async function getEffectiveAssignment({ tenantId, userId, module, platform, channel }) {
    const normalizedTenantId = normalizeTenantId(tenantId);
    const scope = normalizeScope({ module, platform, channel });
    const normalizedUserId = normalizeUserId(userId, { required: false }) || null;

    let userAssignment = null;
    if (normalizedUserId) {
      const { data, error } = await supabase
        .from(assignmentsTable)
        .select('*')
        .eq('tenant_id', normalizedTenantId)
        .eq('module', scope.module)
        .eq('platform', scope.platform)
        .eq('channel', scope.channel)
        .eq('user_id', normalizedUserId)
        .maybeSingle();

      if (error) {
        throw mapSupabaseError(error, 'Failed to read user artifact assignment');
      }
      userAssignment = data || null;
    }

    const { data: defaultAssignment, error: defaultError } = await supabase
      .from(assignmentsTable)
      .select('*')
      .eq('tenant_id', normalizedTenantId)
      .eq('module', scope.module)
      .eq('platform', scope.platform)
      .eq('channel', scope.channel)
      .is('user_id', null)
      .eq('is_default', true)
      .maybeSingle();
    if (defaultError) {
      throw mapSupabaseError(defaultError, 'Failed to read default artifact assignment');
    }

    return {
      user_assignment: userAssignment,
      default_assignment: defaultAssignment || null,
      effective_assignment: userAssignment || defaultAssignment || null,
    };
  }

  async function resolveDownload({
    tenantId,
    actorId,
    leaseToken,
    vmUuid,
    module,
    platform,
    channel,
    requestIp,
  }) {
    const normalizedTenantId = normalizeTenantId(tenantId);
    const scope = normalizeScope({ module, platform, channel });
    const normalizedVmUuid = normalizeVmUuid(vmUuid);
    const normalizedActorId = normalizeUserId(actorId, { required: false }) || null;
    const normalizedRequestIp =
      normalizeString(requestIp, { field: 'request_ip', required: false, maxLength: 120 }) || null;

    const auditEvent = {
      tenant_id: normalizedTenantId,
      lease_id: null,
      lease_jti: null,
      user_id: normalizedActorId,
      vm_uuid: normalizedVmUuid,
      module: scope.module,
      platform: scope.platform,
      channel: scope.channel,
      release_id: null,
      event_type: AUDIT_EVENT_RESOLVE_DENIED,
      result: 'denied',
      reason: 'resolve-in-progress',
      request_ip: normalizedRequestIp,
      url_expires_at_ms: null,
      metadata: {},
    };

    let responsePayload = null;

    try {
      const leaseResolution = await licenseService.resolveActiveLeaseByToken({
        tenantId: normalizedTenantId,
        token: leaseToken,
        expectedVmUuid: normalizedVmUuid,
        expectedModule: scope.module,
      });

      const lease = leaseResolution.lease || {};
      const leaseUserId =
        normalizeUserId(lease.user_id, { required: false }) || normalizedActorId || null;
      const leaseId = String(leaseResolution.lease_id || '').trim() || null;
      const leaseJti = String(leaseResolution?.token_payload?.jti || '').trim() || null;

      auditEvent.lease_id = leaseId;
      auditEvent.lease_jti = leaseJti;
      auditEvent.user_id = leaseUserId;

      const assignment = await getEffectiveAssignment({
        tenantId: normalizedTenantId,
        userId: leaseUserId,
        module: scope.module,
        platform: scope.platform,
        channel: scope.channel,
      });

      if (!assignment.effective_assignment) {
        throw new ArtifactsServiceError(
          404,
          'ARTIFACT_ASSIGNMENT_NOT_FOUND',
          'Artifact assignment not found',
        );
      }

      const releaseId = toPositiveInt(assignment.effective_assignment.release_id, 'release_id');
      const release = await findReleaseById({
        tenantId: normalizedTenantId,
        releaseId,
      });

      auditEvent.release_id = releaseId;
      if (!release) {
        throw new ArtifactsServiceError(
          404,
          'ARTIFACT_RELEASE_NOT_FOUND',
          'Assigned artifact release not found',
        );
      }

      if (String(release.status || '').toLowerCase() !== RELEASE_STATUS_ACTIVE) {
        throw new ArtifactsServiceError(
          409,
          'ARTIFACT_RELEASE_NOT_ACTIVE',
          'Assigned artifact release is not active',
        );
      }

      const objectMetadata = await storageProvider.headObject({
        objectKey: release.object_key,
      });
      if (!objectMetadata.exists) {
        throw new ArtifactsServiceError(
          404,
          'ARTIFACT_OBJECT_NOT_FOUND',
          'Artifact object not found in S3',
        );
      }

      const presigned = await storageProvider.createPresignedDownloadUrl({
        objectKey: release.object_key,
        expiresInSeconds: env.s3PresignTtlSeconds,
      });

      responsePayload = {
        download_url: presigned.url,
        url_expires_at: presigned.expiresAtMs,
        release_id: release.id,
        version: release.version,
        sha256: release.sha256,
        size_bytes: Number(release.size_bytes || 0),
      };

      auditEvent.event_type = AUDIT_EVENT_RESOLVE_SUCCESS;
      auditEvent.result = 'allowed';
      auditEvent.reason = null;
      auditEvent.url_expires_at_ms = presigned.expiresAtMs;
      auditEvent.metadata = {
        source: assignment.user_assignment ? 'user' : 'tenant-default',
      };
    } catch (error) {
      const mappedError = mapResolveError(error);
      auditEvent.event_type = AUDIT_EVENT_RESOLVE_DENIED;
      auditEvent.result = mappedError.status >= 500 ? 'error' : 'denied';
      auditEvent.reason = normalizeAuditReason(mappedError.code);
      auditEvent.metadata = {
        error_code: mappedError.code,
      };
      await recordAudit(auditEvent);
      throw mappedError;
    }

    await recordAudit(auditEvent);
    return responsePayload;
  }

  return {
    enabled: true,
    createRelease,
    upsertAssignment,
    getEffectiveAssignment,
    resolveDownload,
  };
}

module.exports = {
  createArtifactsService,
  ArtifactsServiceError,
};
