const crypto = require('crypto');
const { createSupabaseServiceClient } = require('../../repositories/supabase/client');

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

function createAgentService({ env }) {
  function getClient() {
    const result = createSupabaseServiceClient(env);
    if (!result.ok || !result.client) {
      throw new AgentServiceError(503, 'SERVICE_UNAVAILABLE', 'Supabase is not configured');
    }
    return result.client;
  }

  async function createPairing({ tenantId, name, expiresInMinutes = 15 }) {
    const client = getClient();
    const normalizedTenantId = String(tenantId || '').trim() || 'default';
    const normalizedName = String(name || '').trim() || 'Unnamed Agent';

    const pairingCode = generatePairingCode();
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString();

    const { data, error } = await client
      .from('agents')
      .insert({
        tenant_id: normalizedTenantId,
        name: normalizedName,
        status: 'pending',
        pairing_code: pairingCode,
        pairing_expires_at: expiresAt,
      })
      .select('id, tenant_id, name, status, pairing_code, pairing_expires_at, created_at')
      .single();

    if (error) {
      throw new AgentServiceError(500, 'DB_ERROR', `Failed to create pairing: ${error.message}`);
    }

    return data;
  }

  async function registerAgent({ pairingCode, version, platform, capabilities, pairedBy }) {
    const client = getClient();
    const normalizedCode = String(pairingCode || '').trim();
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

    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await client
      .from('agents')
      .update({
        status: 'active',
        version: version ? String(version).trim() : null,
        platform: platform ? String(platform).trim() : null,
        capabilities: Array.isArray(capabilities) ? capabilities : [],
        pairing_code: null,
        pairing_expires_at: null,
        paired_at: now,
        paired_by: pairedBy ? String(pairedBy).trim() : null,
        last_seen_at: now,
      })
      .eq('id', agent.id)
      .select('id, tenant_id, name, status, version, platform, capabilities, paired_at, last_seen_at, created_at, updated_at')
      .single();

    if (updateError) {
      throw new AgentServiceError(500, 'DB_ERROR', `Failed to register agent: ${updateError.message}`);
    }

    return updated;
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

  async function listAgents({ tenantId, status }) {
    const client = getClient();
    const normalizedTenantId = String(tenantId || '').trim() || 'default';

    let query = client
      .from('agents')
      .select('id, tenant_id, name, status, version, platform, capabilities, last_seen_at, paired_at, revoked_at, created_at, updated_at')
      .eq('tenant_id', normalizedTenantId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', String(status).trim());
    }

    const { data, error } = await query;

    if (error) {
      throw new AgentServiceError(500, 'DB_ERROR', `Failed to list agents: ${error.message}`);
    }

    return data || [];
  }

  async function getAgent({ tenantId, agentId }) {
    const client = getClient();
    const normalizedTenantId = String(tenantId || '').trim() || 'default';
    const normalizedAgentId = String(agentId || '').trim();
    if (!normalizedAgentId) {
      throw new AgentServiceError(400, 'BAD_REQUEST', 'agent_id is required');
    }

    const { data, error } = await client
      .from('agents')
      .select('id, tenant_id, name, status, version, platform, capabilities, last_seen_at, paired_at, revoked_at, revoke_reason, metadata, created_at, updated_at')
      .eq('id', normalizedAgentId)
      .eq('tenant_id', normalizedTenantId)
      .single();

    if (error || !data) {
      throw new AgentServiceError(404, 'AGENT_NOT_FOUND', 'Agent not found');
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
