const crypto = require('crypto');
const { createSupabaseServiceClient } = require('../../repositories/supabase/client');
const { signAgentToken } = require('../../utils/agent-token');

class AgentServiceError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AgentServiceError';
    this.status = Number(status || 500);
    this.code = String(code || 'AGENT_ERROR');
    if (details !== undefined) {
      this.details = details;
    }
  }
}

function generatePairingCode() {
  return crypto.randomBytes(16).toString('hex');
}

function sanitizePairingProxmoxDefaults(value) {
  if (!value || typeof value !== 'object') return null;
  const url = String(value.url || '').trim();
  const username = String(value.username || '').trim();
  const node = String(value.node || '').trim();

  const payload = {};
  if (url) payload.url = url;
  if (username) payload.username = username;
  if (node) payload.node = node;

  return Object.keys(payload).length > 0 ? payload : null;
}

function pickTenantIdFromSupabaseUser(user = {}, fallbackTenantId = 'default') {
  const candidates = [
    user?.app_metadata?.tenant_id,
    user?.app_metadata?.tenantId,
    fallbackTenantId,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return 'default';
}

function createAgentService({ env }) {
  function getSupabaseAuthClient() {
    const { createClient } = require('@supabase/supabase-js');

    const supabaseUrl = String(env?.supabaseUrl || '').trim();
    const supabaseAuthKey = String(env?.supabaseAnonKey || env?.supabaseServiceRoleKey || '').trim();
    if (!supabaseUrl || !supabaseAuthKey) {
      throw new AgentServiceError(
        503,
        'SERVICE_UNAVAILABLE',
        'Supabase auth is not configured (SUPABASE_URL + SUPABASE_ANON_KEY/SERVICE_ROLE_KEY)'
      );
    }

    return createClient(supabaseUrl, supabaseAuthKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }

  async function authenticateUserCredentials({ login, password }) {
    const normalizedLogin = String(login || '').trim();
    const normalizedPassword = String(password || '');
    if (!normalizedLogin || !normalizedPassword) {
      throw new AgentServiceError(400, 'BAD_REQUEST', 'login and password are required');
    }

    const authClient = getSupabaseAuthClient();
    const { data, error } = await authClient.auth.signInWithPassword({
      email: normalizedLogin,
      password: normalizedPassword,
    });

    if (error || !data?.user?.id) {
      throw new AgentServiceError(401, 'INVALID_CREDENTIALS', 'Invalid Bot-Mox login or password');
    }

    const fallbackTenantId = String(env?.defaultTenantId || 'default').trim() || 'default';
    const tenantId = pickTenantIdFromSupabaseUser(data.user, fallbackTenantId);

    return {
      userId: String(data.user.id || '').trim(),
      tenantId,
      email: String(data.user.email || '').trim() || null,
    };
  }

  function getClient() {
    const result = createSupabaseServiceClient(env);
    if (!result.ok || !result.client) {
      throw new AgentServiceError(503, 'SERVICE_UNAVAILABLE', 'Supabase is not configured');
    }
    return result.client;
  }

  async function createPairing({ tenantId, name, expiresInMinutes = 15, ownerUserId }) {
    const client = getClient();
    const normalizedTenantId = String(tenantId || '').trim() || 'default';
    const normalizedName = String(name || '').trim() || 'Unnamed Agent';
    const normalizedOwnerUserId = String(ownerUserId || '').trim() || null;
    if (!normalizedOwnerUserId) {
      throw new AgentServiceError(400, 'BAD_REQUEST', 'owner_user_id is required');
    }

    const pairingCode = generatePairingCode();
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString();

    const { data, error } = await client
      .from('agents')
      .insert({
        tenant_id: normalizedTenantId,
        owner_user_id: normalizedOwnerUserId,
        name: normalizedName,
        status: 'pending',
        pairing_code: pairingCode,
        pairing_expires_at: expiresAt,
      })
      .select('id, tenant_id, owner_user_id, name, status, pairing_code, pairing_expires_at, created_at')
      .single();

    if (error) {
      throw new AgentServiceError(500, 'DB_ERROR', `Failed to create pairing: ${error.message}`);
    }

    let proxmoxDefaults = null;
    try {
      const { data: settingsRow, error: settingsError } = await client
        .from('app_settings')
        .select('data')
        .eq('tenant_id', normalizedTenantId)
        .maybeSingle();

      if (!settingsError && settingsRow?.data && typeof settingsRow.data === 'object') {
        const tree = settingsRow.data;
        const vmgenerator = tree.vmgenerator && typeof tree.vmgenerator === 'object' ? tree.vmgenerator : {};
        const proxmox = vmgenerator.proxmox && typeof vmgenerator.proxmox === 'object' ? vmgenerator.proxmox : {};
        const services = vmgenerator.services && typeof vmgenerator.services === 'object' ? vmgenerator.services : {};
        proxmoxDefaults = sanitizePairingProxmoxDefaults({
          url: proxmox.url || services.proxmoxUrl || '',
          username: proxmox.username || '',
          node: proxmox.node || '',
        });
      }
    } catch {
      proxmoxDefaults = null;
    }

    return {
      ...data,
      proxmox_defaults: proxmoxDefaults,
    };
  }

  async function registerAgent({ pairingCode, machineName, version, platform, capabilities, pairedBy }) {
    const client = getClient();
    const normalizedCode = String(pairingCode || '').trim();
    const normalizedMachineName = String(machineName || '').trim();
    if (!normalizedCode) {
      throw new AgentServiceError(400, 'BAD_REQUEST', 'pairing_code is required');
    }

    const { data: agent, error: lookupError } = await client
      .from('agents')
      .select('*')
      .eq('pairing_code', normalizedCode)
      .eq('status', 'pending')
      .single();

    if (lookupError || !agent) {
      throw new AgentServiceError(404, 'PAIRING_NOT_FOUND', 'Pairing code not found or already used');
    }

    const expiresAt = agent.pairing_expires_at ? new Date(agent.pairing_expires_at).getTime() : 0;
    if (expiresAt > 0 && expiresAt < Date.now()) {
      throw new AgentServiceError(410, 'PAIRING_EXPIRED', 'Pairing code has expired');
    }

    const currentName = String(agent.name || '').trim();
    const hasDefaultName = !currentName || currentName.toLowerCase() === 'unnamed agent';
    let resolvedName = currentName || 'Unnamed Agent';
    if (normalizedMachineName) {
      resolvedName = hasDefaultName ? normalizedMachineName : currentName;
    }

    const currentMetadata = agent.metadata && typeof agent.metadata === 'object' && !Array.isArray(agent.metadata)
      ? agent.metadata
      : {};
    const nextMetadata = normalizedMachineName
      ? { ...currentMetadata, machine_name: normalizedMachineName }
      : currentMetadata;

    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await client
      .from('agents')
      .update({
        name: resolvedName,
        status: 'active',
        version: version ? String(version).trim() : null,
        platform: platform ? String(platform).trim() : null,
        capabilities: Array.isArray(capabilities) ? capabilities : [],
        metadata: nextMetadata,
        pairing_code: null,
        pairing_expires_at: null,
        paired_at: now,
        paired_by: pairedBy ? String(pairedBy).trim() : null,
        last_seen_at: now,
      })
      .eq('id', agent.id)
      .select('id, tenant_id, owner_user_id, name, status, version, platform, capabilities, paired_at, last_seen_at, created_at, updated_at')
      .single();

    if (updateError) {
      throw new AgentServiceError(500, 'DB_ERROR', `Failed to register agent: ${updateError.message}`);
    }

    let tokenPayload;
    try {
      tokenPayload = signAgentToken({
        secret: env?.agentAuthSecret,
        agentId: updated.id,
        tenantId: updated.tenant_id,
        expiresInSeconds: env?.agentTokenTtlSeconds,
      });
    } catch (error) {
      throw new AgentServiceError(503, 'AGENT_AUTH_NOT_CONFIGURED', 'Agent auth secret is not configured');
    }

    return {
      ...updated,
      agent_token: tokenPayload.token,
      agent_token_expires_at: tokenPayload.expiresAt,
    };
  }

  async function quickPairWithCredentials({
    login,
    password,
    machineName,
    version,
    platform,
    capabilities,
    name,
  }) {
    const auth = await authenticateUserCredentials({ login, password });
    const desiredName = String(name || machineName || '').trim() || 'Unnamed Agent';

    const pairing = await createPairing({
      tenantId: auth.tenantId,
      ownerUserId: auth.userId,
      name: desiredName,
      expiresInMinutes: 15,
    });

    return registerAgent({
      pairingCode: pairing.pairing_code,
      machineName,
      version,
      platform,
      capabilities,
      pairedBy: auth.userId,
    });
  }

  async function heartbeat({ tenantId, agentId }) {
    const client = getClient();
    const normalizedTenantId = String(tenantId || '').trim() || 'default';
    const normalizedAgentId = String(agentId || '').trim();
    if (!normalizedAgentId) {
      throw new AgentServiceError(400, 'BAD_REQUEST', 'agent_id is required');
    }

    const { data: agent, error: lookupError } = await client
      .from('agents')
      .select('id, status, tenant_id')
      .eq('id', normalizedAgentId)
      .eq('tenant_id', normalizedTenantId)
      .single();

    if (lookupError || !agent) {
      throw new AgentServiceError(404, 'AGENT_NOT_FOUND', 'Agent not found');
    }

    if (agent.status === 'revoked') {
      throw new AgentServiceError(409, 'AGENT_REVOKED', 'Agent has been revoked');
    }

    if (agent.status !== 'active') {
      throw new AgentServiceError(409, 'AGENT_NOT_ACTIVE', 'Agent is not active');
    }

    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await client
      .from('agents')
      .update({ last_seen_at: now })
      .eq('id', normalizedAgentId)
      .eq('tenant_id', normalizedTenantId)
      .select('id, status, last_seen_at')
      .single();

    if (updateError) {
      throw new AgentServiceError(500, 'DB_ERROR', `Failed to update heartbeat: ${updateError.message}`);
    }

    return updated;
  }

  async function listAgents({ tenantId, status, requesterUserId, includeAll = false }) {
    const client = getClient();
    const normalizedTenantId = String(tenantId || '').trim() || 'default';
    const normalizedRequesterUserId = String(requesterUserId || '').trim();

    let query = client
      .from('agents')
      .select('id, tenant_id, owner_user_id, name, status, version, platform, capabilities, last_seen_at, paired_at, revoked_at, created_at, updated_at')
      .eq('tenant_id', normalizedTenantId)
      .order('created_at', { ascending: false });

    if (!includeAll) {
      if (!normalizedRequesterUserId) {
        return [];
      }
      query = query.eq('owner_user_id', normalizedRequesterUserId);
    }

    if (status) {
      query = query.eq('status', String(status).trim());
    }

    const { data, error } = await query;

    if (error) {
      throw new AgentServiceError(500, 'DB_ERROR', `Failed to list agents: ${error.message}`);
    }

    return data || [];
  }

  async function getAgent({ tenantId, agentId, requesterUserId, includeAll = false }) {
    const client = getClient();
    const normalizedTenantId = String(tenantId || '').trim() || 'default';
    const normalizedAgentId = String(agentId || '').trim();
    const normalizedRequesterUserId = String(requesterUserId || '').trim();
    if (!normalizedAgentId) {
      throw new AgentServiceError(400, 'BAD_REQUEST', 'agent_id is required');
    }

    const { data, error } = await client
      .from('agents')
      .select('id, tenant_id, owner_user_id, name, status, version, platform, capabilities, last_seen_at, paired_at, revoked_at, revoke_reason, metadata, created_at, updated_at')
      .eq('id', normalizedAgentId)
      .eq('tenant_id', normalizedTenantId)
      .single();

    if (error || !data) {
      throw new AgentServiceError(404, 'AGENT_NOT_FOUND', 'Agent not found');
    }

    if (!includeAll) {
      const ownerUserId = String(data.owner_user_id || '').trim();
      if (!normalizedRequesterUserId || ownerUserId !== normalizedRequesterUserId) {
        throw new AgentServiceError(404, 'AGENT_NOT_FOUND', 'Agent not found');
      }
    }

    return data;
  }

  async function revokeAgent({ tenantId, agentId, revokedBy, reason }) {
    const client = getClient();
    const normalizedTenantId = String(tenantId || '').trim() || 'default';
    const normalizedAgentId = String(agentId || '').trim();
    if (!normalizedAgentId) {
      throw new AgentServiceError(400, 'BAD_REQUEST', 'agent_id is required');
    }

    const { data: agent, error: lookupError } = await client
      .from('agents')
      .select('id, status, tenant_id')
      .eq('id', normalizedAgentId)
      .eq('tenant_id', normalizedTenantId)
      .single();

    if (lookupError || !agent) {
      throw new AgentServiceError(404, 'AGENT_NOT_FOUND', 'Agent not found');
    }

    if (agent.status === 'revoked') {
      throw new AgentServiceError(409, 'ALREADY_REVOKED', 'Agent is already revoked');
    }

    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await client
      .from('agents')
      .update({
        status: 'revoked',
        revoked_at: now,
        revoked_by: revokedBy ? String(revokedBy).trim() : null,
        revoke_reason: reason ? String(reason).trim() : null,
      })
      .eq('id', normalizedAgentId)
      .eq('tenant_id', normalizedTenantId)
      .select('id, status, revoked_at, revoked_by, revoke_reason')
      .single();

    if (updateError) {
      throw new AgentServiceError(500, 'DB_ERROR', `Failed to revoke agent: ${updateError.message}`);
    }

    return updated;
  }

  async function isAgentOnline({ tenantId, agentId, staleThresholdMs = 120_000 }) {
    const client = getClient();
    const normalizedTenantId = String(tenantId || '').trim() || 'default';
    const normalizedAgentId = String(agentId || '').trim();

    const { data, error } = await client
      .from('agents')
      .select('id, status, last_seen_at')
      .eq('id', normalizedAgentId)
      .eq('tenant_id', normalizedTenantId)
      .single();

    if (error || !data) return false;
    if (data.status !== 'active') return false;

    const lastSeen = data.last_seen_at ? new Date(data.last_seen_at).getTime() : 0;
    return lastSeen > 0 && (Date.now() - lastSeen) < staleThresholdMs;
  }

  return {
    createPairing,
    registerAgent,
    quickPairWithCredentials,
    heartbeat,
    listAgents,
    getAgent,
    revokeAgent,
    isAgentOnline,
  };
}

module.exports = {
  createAgentService,
  AgentServiceError,
};
