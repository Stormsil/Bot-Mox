const crypto = require('node:crypto');
const { createSupabaseServiceClient } = require('../../repositories/supabase/client');

class ProvisioningServiceError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ProvisioningServiceError';
    this.status = Number(status || 500);
    this.code = String(code || 'PROVISIONING_ERROR');
    if (details !== undefined) {
      this.details = details;
    }
  }
}

// ---------------------------------------------------------------------------
// Minimal JWT helpers (same pattern as agent-token.js)
// ---------------------------------------------------------------------------

function base64UrlEncode(value) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(String(value), 'utf8');
  return buffer.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlDecode(value) {
  const normalized = String(value || '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const padLen = (4 - (normalized.length % 4)) % 4;
  return Buffer.from(normalized + '='.repeat(padLen), 'base64').toString('utf8');
}

function hmacSha256Base64Url(message, secret) {
  return base64UrlEncode(crypto.createHmac('sha256', secret).update(message).digest());
}

function safeJsonParse(text) {
  try {
    return JSON.parse(String(text || ''));
  } catch {
    return null;
  }
}

function signProvisionToken({ secret, userId, tenantId, vmUuid, expiresInSeconds }) {
  const nowSec = Math.floor(Date.now() / 1000);
  const payload = {
    typ: 'provision',
    sub: String(userId),
    vm: String(vmUuid),
    tid: String(tenantId || 'default'),
    iat: nowSec,
    exp: nowSec + Math.max(60, Number(expiresInSeconds) || 86400 * 30),
  };
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = hmacSha256Base64Url(signingInput, secret);
  return { token: `${signingInput}.${signature}`, payload };
}

function verifyProvisionToken(token, secret) {
  const normalizedToken = String(token || '').trim();
  const normalizedSecret = String(secret || '').trim();
  if (!normalizedToken || !normalizedSecret) return null;

  const parts = normalizedToken.split('.');
  if (parts.length !== 3) return null;
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  if (!encodedHeader || !encodedPayload || !encodedSignature) return null;

  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = hmacSha256Base64Url(signingInput, normalizedSecret);

  const sigA = Buffer.from(encodedSignature, 'utf8');
  const sigB = Buffer.from(expectedSignature, 'utf8');
  if (sigA.length !== sigB.length) return null;
  if (!crypto.timingSafeEqual(sigA, sigB)) return null;

  const header = safeJsonParse(base64UrlDecode(encodedHeader));
  const payload = safeJsonParse(base64UrlDecode(encodedPayload));
  if (!header || !payload) return null;
  if (header.alg !== 'HS256') return null;
  if (payload.typ !== 'provision') return null;

  const nowSec = Math.floor(Date.now() / 1000);
  if (Number(payload.exp || 0) <= nowSec) return null;

  return {
    userId: String(payload.sub || ''),
    tenantId: String(payload.tid || 'default'),
    vmUuid: String(payload.vm || ''),
    claims: payload,
  };
}

// ---------------------------------------------------------------------------
// Service factory
// ---------------------------------------------------------------------------

function createProvisioningService({ env }) {
  function getClient() {
    const result = createSupabaseServiceClient(env);
    if (!result.ok || !result.client) {
      throw new ProvisioningServiceError(503, 'SERVICE_UNAVAILABLE', 'Supabase is not configured');
    }
    return result.client;
  }

  function getSecret() {
    const secret = String(
      env.provisionTokenSecret || env.agentAuthSecret || env.licenseLeaseSecret || '',
    ).trim();
    if (!secret) {
      throw new ProvisioningServiceError(
        500,
        'CONFIG_ERROR',
        'PROVISION_TOKEN_SECRET is not configured',
      );
    }
    return secret;
  }

  // --- Unattend Profiles CRUD ---

  async function listProfiles({ tenantId, userId }) {
    const client = getClient();
    const { data, error } = await client
      .from('unattend_profiles')
      .select('*')
      .eq('tenant_id', String(tenantId || 'default'))
      .eq('user_id', String(userId))
      .order('created_at', { ascending: true });

    if (error) {
      throw new ProvisioningServiceError(
        500,
        'DB_ERROR',
        `Failed to list profiles: ${error.message}`,
      );
    }
    return data || [];
  }

  async function getProfile({ tenantId, userId, profileId }) {
    const client = getClient();
    const { data, error } = await client
      .from('unattend_profiles')
      .select('*')
      .eq('id', String(profileId))
      .eq('tenant_id', String(tenantId || 'default'))
      .eq('user_id', String(userId))
      .single();

    if (error || !data) {
      throw new ProvisioningServiceError(404, 'PROFILE_NOT_FOUND', 'Unattend profile not found');
    }
    return data;
  }

  async function createProfile({ tenantId, userId, name, isDefault, config }) {
    const client = getClient();
    const normalizedTenantId = String(tenantId || 'default');
    const normalizedUserId = String(userId);

    if (isDefault) {
      await client
        .from('unattend_profiles')
        .update({ is_default: false })
        .eq('tenant_id', normalizedTenantId)
        .eq('user_id', normalizedUserId)
        .eq('is_default', true);
    }

    const { data, error } = await client
      .from('unattend_profiles')
      .insert({
        tenant_id: normalizedTenantId,
        user_id: normalizedUserId,
        name: String(name).trim(),
        is_default: Boolean(isDefault),
        config,
      })
      .select('*')
      .single();

    if (error) {
      if (String(error.code) === '23505') {
        throw new ProvisioningServiceError(
          409,
          'DUPLICATE_NAME',
          `Profile name "${name}" already exists`,
        );
      }
      throw new ProvisioningServiceError(
        500,
        'DB_ERROR',
        `Failed to create profile: ${error.message}`,
      );
    }
    return data;
  }

  async function updateProfile({ tenantId, userId, profileId, updates }) {
    const client = getClient();
    const normalizedTenantId = String(tenantId || 'default');
    const normalizedUserId = String(userId);

    const patch = { updated_at: new Date().toISOString() };
    if (updates.name !== undefined) patch.name = String(updates.name).trim();
    if (updates.config !== undefined) patch.config = updates.config;
    if (updates.is_default !== undefined) {
      patch.is_default = Boolean(updates.is_default);
      if (patch.is_default) {
        await client
          .from('unattend_profiles')
          .update({ is_default: false })
          .eq('tenant_id', normalizedTenantId)
          .eq('user_id', normalizedUserId)
          .eq('is_default', true);
      }
    }

    const { data, error } = await client
      .from('unattend_profiles')
      .update(patch)
      .eq('id', String(profileId))
      .eq('tenant_id', normalizedTenantId)
      .eq('user_id', normalizedUserId)
      .select('*')
      .single();

    if (error || !data) {
      throw new ProvisioningServiceError(404, 'PROFILE_NOT_FOUND', 'Unattend profile not found');
    }
    return data;
  }

  async function deleteProfile({ tenantId, userId, profileId }) {
    const client = getClient();
    const { data, error } = await client
      .from('unattend_profiles')
      .delete()
      .eq('id', String(profileId))
      .eq('tenant_id', String(tenantId || 'default'))
      .eq('user_id', String(userId))
      .select('id');

    if (error) {
      throw new ProvisioningServiceError(
        500,
        'DB_ERROR',
        `Failed to delete profile: ${error.message}`,
      );
    }

    if (!Array.isArray(data) || data.length === 0) {
      throw new ProvisioningServiceError(404, 'PROFILE_NOT_FOUND', 'Unattend profile not found');
    }
  }

  // --- Provisioning Tokens ---

  async function issueToken({ tenantId, userId, vmUuid, expiresInDays = 3650 }) {
    const client = getClient();
    const secret = getSecret();
    const normalizedTenantId = String(tenantId || 'default');
    const expiresInSeconds = Math.max(60, Number(expiresInDays) * 86400);

    const { token, payload } = signProvisionToken({
      secret,
      userId,
      tenantId: normalizedTenantId,
      vmUuid,
      expiresInSeconds,
    });

    const expiresAt = new Date(payload.exp * 1000).toISOString();

    // Upsert — replace existing token for same VM
    const { data, error } = await client
      .from('provisioning_tokens')
      .upsert(
        {
          tenant_id: normalizedTenantId,
          user_id: String(userId),
          vm_uuid: String(vmUuid),
          token,
          status: 'active',
          issued_at: new Date().toISOString(),
          expires_at: expiresAt,
          used_at: null,
          metadata: {},
        },
        { onConflict: 'tenant_id,vm_uuid' },
      )
      .select('id, token, expires_at')
      .single();

    if (error) {
      throw new ProvisioningServiceError(
        500,
        'DB_ERROR',
        `Failed to issue token: ${error.message}`,
      );
    }

    return { tokenId: data.id, token: data.token, expiresAt: data.expires_at };
  }

  async function validateToken(token, vmUuid) {
    const secret = getSecret();
    const decoded = verifyProvisionToken(token, secret);
    if (!decoded) {
      return { valid: false, reason: 'Invalid or expired token signature' };
    }

    if (String(decoded.vmUuid) !== String(vmUuid)) {
      return { valid: false, reason: 'Token VM UUID mismatch' };
    }

    const client = getClient();
    const { data, error } = await client
      .from('provisioning_tokens')
      .select('id, status, expires_at')
      .eq('token', String(token))
      .single();

    if (error || !data) {
      return { valid: false, reason: 'Token not found in database' };
    }

    if (data.status !== 'active') {
      return { valid: false, reason: `Token status is "${data.status}"` };
    }

    const expiresAtMs = new Date(data.expires_at).getTime();
    if (expiresAtMs <= Date.now()) {
      return { valid: false, reason: 'Token has expired' };
    }

    // Subscription gate — refuse if the user has no active subscription
    const { data: subs } = await client
      .from('subscriptions')
      .select('id')
      .eq('tenant_id', decoded.tenantId)
      .eq('user_id', decoded.userId)
      .in('status', ['active', 'expiring_soon'])
      .limit(1);

    if (!subs || subs.length === 0) {
      return { valid: false, reason: 'No active subscription' };
    }

    return {
      valid: true,
      userId: decoded.userId,
      tenantId: decoded.tenantId,
      tokenId: data.id,
    };
  }

  async function markUsed(tokenId) {
    const client = getClient();
    await client
      .from('provisioning_tokens')
      .update({ status: 'used', used_at: new Date().toISOString() })
      .eq('id', String(tokenId))
      .eq('status', 'active');
  }

  async function revokeToken(tokenId) {
    const client = getClient();
    await client
      .from('provisioning_tokens')
      .update({ status: 'revoked' })
      .eq('id', String(tokenId));
  }

  async function revokeByVmUuid({ tenantId, vmUuid }) {
    const client = getClient();
    await client
      .from('provisioning_tokens')
      .update({ status: 'revoked' })
      .eq('tenant_id', String(tenantId || 'default'))
      .eq('vm_uuid', String(vmUuid))
      .eq('status', 'active');
  }

  // --- VM Setup Progress ---

  async function reportProgress({ tenantId, vmUuid, tokenId, step, status, details }) {
    const client = getClient();
    const { data, error } = await client
      .from('vm_setup_progress')
      .insert({
        tenant_id: String(tenantId || 'default'),
        vm_uuid: String(vmUuid),
        token_id: tokenId || null,
        step: String(step),
        status: String(status),
        details: details || {},
      })
      .select('*')
      .single();

    if (error) {
      throw new ProvisioningServiceError(
        500,
        'DB_ERROR',
        `Failed to report progress: ${error.message}`,
      );
    }
    return data;
  }

  async function getProgress({ tenantId, vmUuid }) {
    const client = getClient();
    const { data, error } = await client
      .from('vm_setup_progress')
      .select('*')
      .eq('tenant_id', String(tenantId || 'default'))
      .eq('vm_uuid', String(vmUuid))
      .order('created_at', { ascending: true });

    if (error) {
      throw new ProvisioningServiceError(
        500,
        'DB_ERROR',
        `Failed to get progress: ${error.message}`,
      );
    }
    return data || [];
  }

  return {
    listProfiles,
    getProfile,
    createProfile,
    updateProfile,
    deleteProfile,
    issueToken,
    validateToken,
    markUsed,
    revokeToken,
    revokeByVmUuid,
    reportProgress,
    getProgress,
  };
}

module.exports = {
  createProvisioningService,
  ProvisioningServiceError,
};
