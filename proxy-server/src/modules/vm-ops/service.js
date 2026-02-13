const { createSupabaseServiceClient } = require('../../repositories/supabase/client');

class VmOpsServiceError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'VmOpsServiceError';
    this.status = Number(status || 500);
    this.code = String(code || 'VM_OPS_ERROR');
    if (details !== undefined) {
      this.details = details;
    }
  }
}

function createVmOpsService({ env, agentService }) {
  function getClient() {
    const result = createSupabaseServiceClient(env);
    if (!result.ok || !result.client) {
      throw new VmOpsServiceError(503, 'SERVICE_UNAVAILABLE', 'Supabase is not configured');
    }
    return result.client;
  }

  async function dispatchCommand({ tenantId, agentId, commandType, payload, expiresInSeconds = 300, createdBy }) {
    const client = getClient();
    const normalizedTenantId = String(tenantId || '').trim() || 'default';
    const normalizedAgentId = String(agentId || '').trim();

    if (!normalizedAgentId) {
      throw new VmOpsServiceError(400, 'BAD_REQUEST', 'agent_id is required');
    }

    // Check agent is online (fail-fast)
    const isOnline = await agentService.isAgentOnline({
      tenantId: normalizedTenantId,
      agentId: normalizedAgentId,
    });

    if (!isOnline) {
      throw new VmOpsServiceError(409, 'AGENT_OFFLINE', 'Agent is not online. VM operations require an active agent connection.');
    }

    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

    const { data, error } = await client
      .from('agent_commands')
      .insert({
        tenant_id: normalizedTenantId,
        agent_id: normalizedAgentId,
        command_type: String(commandType || '').trim(),
        payload: payload && typeof payload === 'object' ? payload : {},
        status: 'queued',
        expires_at: expiresAt,
        created_by: createdBy ? String(createdBy).trim() : null,
      })
      .select('id, tenant_id, agent_id, command_type, status, queued_at, expires_at')
      .single();

    if (error) {
      throw new VmOpsServiceError(500, 'DB_ERROR', `Failed to queue command: ${error.message}`);
    }

    return data;
  }

  async function getCommandStatus({ tenantId, commandId }) {
    const client = getClient();
    const normalizedTenantId = String(tenantId || '').trim() || 'default';
    const normalizedCommandId = String(commandId || '').trim();

    if (!normalizedCommandId) {
      throw new VmOpsServiceError(400, 'BAD_REQUEST', 'command_id is required');
    }

    const { data, error } = await client
      .from('agent_commands')
      .select('id, tenant_id, agent_id, command_type, status, result, error_message, queued_at, started_at, completed_at, expires_at')
      .eq('id', normalizedCommandId)
      .eq('tenant_id', normalizedTenantId)
      .single();

    if (error || !data) {
      throw new VmOpsServiceError(404, 'COMMAND_NOT_FOUND', 'Command not found');
    }

    return data;
  }

  async function updateCommandStatus({ tenantId, commandId, agentId, status, result, errorMessage }) {
    const client = getClient();
    const normalizedTenantId = String(tenantId || '').trim() || 'default';
    const normalizedCommandId = String(commandId || '').trim();

    // Verify command belongs to agent and tenant
    const { data: existing, error: lookupError } = await client
      .from('agent_commands')
      .select('id, agent_id, tenant_id, status')
      .eq('id', normalizedCommandId)
      .eq('tenant_id', normalizedTenantId)
      .single();

    if (lookupError || !existing) {
      throw new VmOpsServiceError(404, 'COMMAND_NOT_FOUND', 'Command not found');
    }

    if (agentId && String(existing.agent_id) !== String(agentId)) {
      throw new VmOpsServiceError(403, 'FORBIDDEN', 'Command belongs to another agent');
    }

    const updatePayload = { status };

    if (status === 'running') {
      updatePayload.started_at = new Date().toISOString();
    }

    if (status === 'succeeded' || status === 'failed') {
      updatePayload.completed_at = new Date().toISOString();
    }

    if (result !== undefined) {
      updatePayload.result = result;
    }

    if (errorMessage !== undefined) {
      updatePayload.error_message = String(errorMessage).trim();
    }

    const { data, error } = await client
      .from('agent_commands')
      .update(updatePayload)
      .eq('id', normalizedCommandId)
      .eq('tenant_id', normalizedTenantId)
      .select('id, tenant_id, agent_id, command_type, status, result, error_message, queued_at, started_at, completed_at')
      .single();

    if (error) {
      throw new VmOpsServiceError(500, 'DB_ERROR', `Failed to update command: ${error.message}`);
    }

    return data;
  }

  async function listAgentCommands({ tenantId, agentId, status }) {
    const client = getClient();
    const normalizedTenantId = String(tenantId || '').trim() || 'default';

    let query = client
      .from('agent_commands')
      .select('id, tenant_id, agent_id, command_type, status, queued_at, started_at, completed_at, expires_at')
      .eq('tenant_id', normalizedTenantId)
      .order('queued_at', { ascending: false })
      .limit(100);

    if (agentId) {
      query = query.eq('agent_id', String(agentId).trim());
    }

    if (status) {
      query = query.eq('status', String(status).trim());
    }

    const { data, error } = await query;

    if (error) {
      throw new VmOpsServiceError(500, 'DB_ERROR', `Failed to list commands: ${error.message}`);
    }

    return data || [];
  }

  return {
    dispatchCommand,
    getCommandStatus,
    updateCommandStatus,
    listAgentCommands,
  };
}

module.exports = {
  createVmOpsService,
  VmOpsServiceError,
};
