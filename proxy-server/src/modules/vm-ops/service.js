const { createSupabaseServiceClient } = require('../../repositories/supabase/client');
const { publishVmOpsCommandEvent, subscribeVmOpsCommandEvents } = require('./events-bus');

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

const READ_ONLY_COMMAND_TYPES = new Set([
  'proxmox.status',
  'proxmox.ssh-status',
  'proxmox.ssh-test',
  'proxmox.list-vms',
  'proxmox.list-targets',
  'proxmox.cluster-resources',
  'proxmox.get-config',
  'proxmox.vm-status',
]);
const READ_ONLY_DEDUPE_WINDOW_MS = 10_000;

function stableStringify(value) {
  if (value === null || value === undefined) {
    return 'null';
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value)
      .sort(([first], [second]) => String(first).localeCompare(String(second)))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`);
    return `{${entries.join(',')}}`;
  }

  return JSON.stringify(value);
}

function createVmOpsService({ env }) {
  function getClient() {
    const result = createSupabaseServiceClient(env);
    if (!result.ok || !result.client) {
      throw new VmOpsServiceError(503, 'SERVICE_UNAVAILABLE', 'Supabase is not configured');
    }
    return result.client;
  }

  async function assertAgentOwnership({
    client,
    tenantId,
    agentId,
    requesterUserId,
    isPrivileged = false,
  }) {
    const normalizedTenantId = String(tenantId || '').trim() || 'default';
    const normalizedAgentId = String(agentId || '').trim();
    const normalizedRequesterUserId = String(requesterUserId || '').trim();

    const { data: agent, error } = await client
      .from('agents')
      .select('id, owner_user_id')
      .eq('id', normalizedAgentId)
      .eq('tenant_id', normalizedTenantId)
      .single();

    if (error || !agent) {
      throw new VmOpsServiceError(404, 'AGENT_NOT_FOUND', 'Agent not found');
    }

    const ownerUserId = String(agent.owner_user_id || '').trim();
    if (!isPrivileged && !ownerUserId) {
      throw new VmOpsServiceError(403, 'AGENT_OWNER_UNASSIGNED', 'Agent is not bound to a user');
    }
    if (!isPrivileged && ownerUserId !== normalizedRequesterUserId) {
      throw new VmOpsServiceError(403, 'AGENT_OWNER_MISMATCH', 'Agent belongs to another user');
    }
  }

  async function dispatchCommand({
    tenantId,
    agentId,
    commandType,
    payload,
    expiresInSeconds = 300,
    createdBy,
    requesterUserId,
    isPrivileged = false,
  }) {
    const client = getClient();
    const normalizedTenantId = String(tenantId || '').trim() || 'default';
    const normalizedAgentId = String(agentId || '').trim();
    const normalizedRequesterUserId = String(requesterUserId || '').trim();
    const normalizedCommandType = String(commandType || '').trim();
    const normalizedPayload = payload && typeof payload === 'object' ? payload : {};

    if (!normalizedAgentId) {
      throw new VmOpsServiceError(400, 'BAD_REQUEST', 'agent_id is required');
    }

    const { data: agent, error: agentError } = await client
      .from('agents')
      .select('id, status, last_seen_at, owner_user_id')
      .eq('id', normalizedAgentId)
      .eq('tenant_id', normalizedTenantId)
      .single();

    if (agentError || !agent) {
      throw new VmOpsServiceError(404, 'AGENT_NOT_FOUND', 'Agent not found');
    }

    const ownerUserId = String(agent.owner_user_id || '').trim();
    if (!isPrivileged && !ownerUserId) {
      throw new VmOpsServiceError(403, 'AGENT_OWNER_UNASSIGNED', 'Agent is not bound to a user');
    }
    if (!isPrivileged && ownerUserId !== normalizedRequesterUserId) {
      throw new VmOpsServiceError(403, 'AGENT_OWNER_MISMATCH', 'Agent belongs to another user');
    }

    const lastSeenAtMs = agent.last_seen_at ? new Date(agent.last_seen_at).getTime() : 0;
    const isOnline =
      String(agent.status || '')
        .trim()
        .toLowerCase() === 'active' &&
      lastSeenAtMs > 0 &&
      Date.now() - lastSeenAtMs < 120_000;

    if (!isOnline) {
      throw new VmOpsServiceError(
        409,
        'AGENT_OFFLINE',
        'Agent is not online. VM operations require an active agent connection.',
      );
    }

    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();
    const dedupeAllowed = READ_ONLY_COMMAND_TYPES.has(normalizedCommandType);

    if (dedupeAllowed) {
      let dedupeQuery = client
        .from('agent_commands')
        .select(
          'id, tenant_id, agent_id, command_type, status, payload, result, error_message, queued_at, started_at, completed_at, expires_at, created_by',
        )
        .eq('tenant_id', normalizedTenantId)
        .eq('agent_id', normalizedAgentId)
        .eq('command_type', normalizedCommandType)
        .in('status', ['queued', 'running', 'succeeded'])
        .order('queued_at', { ascending: false })
        .limit(25);

      if (!isPrivileged && normalizedRequesterUserId) {
        dedupeQuery = dedupeQuery.eq('created_by', normalizedRequesterUserId);
      }

      const { data: recentCommands, error: dedupeLookupError } = await dedupeQuery;
      if (!dedupeLookupError && Array.isArray(recentCommands) && recentCommands.length > 0) {
        const nowMs = Date.now();
        const normalizedPayloadHash = stableStringify(normalizedPayload);

        const reusable = recentCommands.find((candidate) => {
          const queuedAtMs = candidate.queued_at ? new Date(candidate.queued_at).getTime() : 0;
          const completedAtMs = candidate.completed_at
            ? new Date(candidate.completed_at).getTime()
            : 0;
          const candidateFreshness = candidate.status === 'succeeded' ? completedAtMs : queuedAtMs;
          if (!candidateFreshness || nowMs - candidateFreshness > READ_ONLY_DEDUPE_WINDOW_MS) {
            return false;
          }
          return stableStringify(candidate.payload || {}) === normalizedPayloadHash;
        });

        if (reusable) {
          return reusable;
        }
      }
    }

    const { data, error } = await client
      .from('agent_commands')
      .insert({
        tenant_id: normalizedTenantId,
        agent_id: normalizedAgentId,
        command_type: normalizedCommandType,
        payload: normalizedPayload,
        status: 'queued',
        expires_at: expiresAt,
        created_by: createdBy ? String(createdBy).trim() : null,
      })
      .select(
        'id, tenant_id, agent_id, command_type, payload, status, result, error_message, queued_at, started_at, completed_at, expires_at, created_by',
      )
      .single();

    if (error) {
      throw new VmOpsServiceError(500, 'DB_ERROR', `Failed to queue command: ${error.message}`);
    }

    publishVmOpsCommandEvent({
      eventType: 'command.queued',
      tenantId: normalizedTenantId,
      command: data,
    });

    return data;
  }

  async function getCommandStatus({
    tenantId,
    commandId,
    agentId,
    requesterUserId,
    isPrivileged = false,
    requestSource = 'user',
  }) {
    const client = getClient();
    const normalizedTenantId = String(tenantId || '').trim() || 'default';
    const normalizedCommandId = String(commandId || '').trim();
    const normalizedRequesterUserId = String(requesterUserId || '').trim();

    if (!normalizedCommandId) {
      throw new VmOpsServiceError(400, 'BAD_REQUEST', 'command_id is required');
    }

    const { data, error } = await client
      .from('agent_commands')
      .select(
        'id, tenant_id, agent_id, command_type, status, result, error_message, queued_at, started_at, completed_at, expires_at, created_by',
      )
      .eq('id', normalizedCommandId)
      .eq('tenant_id', normalizedTenantId)
      .single();

    if (error || !data) {
      throw new VmOpsServiceError(404, 'COMMAND_NOT_FOUND', 'Command not found');
    }

    if (agentId && String(data.agent_id) !== String(agentId)) {
      throw new VmOpsServiceError(403, 'FORBIDDEN', 'Command belongs to another agent');
    }

    if (!agentId && requestSource !== 'agent') {
      await assertAgentOwnership({
        client,
        tenantId: normalizedTenantId,
        agentId: data.agent_id,
        requesterUserId: normalizedRequesterUserId,
        isPrivileged,
      });

      const createdBy = String(data.created_by || '').trim();
      if (!isPrivileged && createdBy && createdBy !== normalizedRequesterUserId) {
        throw new VmOpsServiceError(404, 'COMMAND_NOT_FOUND', 'Command not found');
      }
    }

    return data;
  }

  async function updateCommandStatus({
    tenantId,
    commandId,
    agentId,
    status,
    result,
    errorMessage,
  }) {
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
      .select(
        'id, tenant_id, agent_id, command_type, payload, status, result, error_message, queued_at, started_at, completed_at, expires_at, created_by',
      )
      .single();

    if (error) {
      throw new VmOpsServiceError(500, 'DB_ERROR', `Failed to update command: ${error.message}`);
    }

    publishVmOpsCommandEvent({
      eventType: `command.${status}`,
      tenantId: normalizedTenantId,
      command: data,
    });

    return data;
  }

  async function ensureAgentAccess({
    tenantId,
    agentId,
    requesterUserId,
    requesterAgentId,
    isPrivileged = false,
    requestSource = 'user',
  }) {
    const normalizedAgentId = String(agentId || '').trim();
    if (!normalizedAgentId) {
      return;
    }

    if (requestSource === 'agent') {
      const normalizedRequesterAgentId = String(requesterAgentId || '').trim();
      if (normalizedRequesterAgentId && normalizedRequesterAgentId !== normalizedAgentId) {
        throw new VmOpsServiceError(
          403,
          'FORBIDDEN',
          'Agent token can only access its own command queue',
        );
      }
      return;
    }

    const client = getClient();
    await assertAgentOwnership({
      client,
      tenantId: String(tenantId || '').trim() || 'default',
      agentId: normalizedAgentId,
      requesterUserId,
      isPrivileged,
    });
  }

  async function listAgentCommands({
    tenantId,
    agentId,
    status,
    requesterUserId,
    isPrivileged = false,
    requestSource = 'user',
  }) {
    const client = getClient();
    const normalizedTenantId = String(tenantId || '').trim() || 'default';
    const normalizedRequesterUserId = String(requesterUserId || '').trim();
    const normalizedAgentId = String(agentId || '').trim();

    if (normalizedAgentId && requestSource !== 'agent') {
      await assertAgentOwnership({
        client,
        tenantId: normalizedTenantId,
        agentId: normalizedAgentId,
        requesterUserId: normalizedRequesterUserId,
        isPrivileged,
      });
    }

    if (!isPrivileged && requestSource !== 'agent' && !normalizedRequesterUserId) {
      return [];
    }

    let query = client
      .from('agent_commands')
      .select(
        'id, tenant_id, agent_id, command_type, payload, status, queued_at, started_at, completed_at, expires_at, created_by',
      )
      .eq('tenant_id', normalizedTenantId)
      .order('queued_at', { ascending: false })
      .limit(100);

    if (normalizedAgentId) {
      query = query.eq('agent_id', normalizedAgentId);
    }

    if (status) {
      query = query.eq('status', String(status).trim());
    }

    if (!isPrivileged && requestSource !== 'agent') {
      query = query.eq('created_by', normalizedRequesterUserId);
    }

    const { data, error } = await query;

    if (error) {
      throw new VmOpsServiceError(500, 'DB_ERROR', `Failed to list commands: ${error.message}`);
    }

    return data || [];
  }

  async function waitForNextAgentCommand({
    tenantId,
    agentId,
    requesterUserId,
    requesterAgentId,
    isPrivileged = false,
    requestSource = 'agent',
    timeoutMs = 25_000,
  }) {
    const client = getClient();
    const normalizedTenantId = String(tenantId || '').trim() || 'default';
    const normalizedAgentId = String(agentId || '').trim();

    if (!normalizedAgentId) {
      throw new VmOpsServiceError(400, 'BAD_REQUEST', 'agent_id is required');
    }

    await ensureAgentAccess({
      tenantId: normalizedTenantId,
      agentId: normalizedAgentId,
      requesterUserId,
      requesterAgentId,
      isPrivileged,
      requestSource,
    });

    const normalizedTimeoutMs = Math.max(
      1_000,
      Math.min(60_000, Math.trunc(Number(timeoutMs) || 25_000)),
    );

    const commandSelectFields =
      'id, tenant_id, agent_id, command_type, payload, status, result, error_message, queued_at, started_at, completed_at, expires_at, created_by';

    const markQueuedCommandExpired = async (command) => {
      const nowIso = new Date().toISOString();
      const { data: updated, error: updateError } = await client
        .from('agent_commands')
        .update({
          status: 'failed',
          completed_at: nowIso,
          error_message: 'Command expired before agent pickup',
        })
        .eq('id', String(command.id || '').trim())
        .eq('tenant_id', normalizedTenantId)
        .eq('status', 'queued')
        .select(commandSelectFields)
        .maybeSingle();

      if (updateError) {
        return;
      }
      if (updated) {
        publishVmOpsCommandEvent({
          eventType: 'command.failed',
          tenantId: normalizedTenantId,
          command: updated,
        });
      }
    };

    const loadNextQueuedCommand = async () => {
      for (let attempt = 0; attempt < 50; attempt += 1) {
        const { data, error } = await client
          .from('agent_commands')
          .select(commandSelectFields)
          .eq('tenant_id', normalizedTenantId)
          .eq('agent_id', normalizedAgentId)
          .eq('status', 'queued')
          .order('queued_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (error) {
          throw new VmOpsServiceError(
            500,
            'DB_ERROR',
            `Failed to fetch queued command: ${error.message}`,
          );
        }
        if (!data) {
          return null;
        }

        const expiresAtMs = data.expires_at ? new Date(data.expires_at).getTime() : 0;
        if (expiresAtMs > 0 && expiresAtMs <= Date.now()) {
          await markQueuedCommandExpired(data);
          continue;
        }

        return data;
      }

      return null;
    };

    return new Promise((resolve, reject) => {
      let settled = false;
      const cleanupCallbacks = [];
      const cleanup = () => {
        while (cleanupCallbacks.length > 0) {
          const cb = cleanupCallbacks.pop();
          try {
            cb();
          } catch {
            // noop
          }
        }
      };

      const settle = (value, error) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (error) {
          reject(error);
          return;
        }
        resolve(value);
      };

      const unsubscribe = subscribeVmOpsCommandEvents((event) => {
        if (!event || typeof event !== 'object') {
          return;
        }
        if (String(event.tenant_id || '').trim() !== normalizedTenantId) {
          return;
        }
        if (String(event.event_type || '').trim() !== 'command.queued') {
          return;
        }

        const command = event.command && typeof event.command === 'object' ? event.command : null;
        if (!command) {
          return;
        }
        if (String(command.agent_id || '').trim() !== normalizedAgentId) {
          return;
        }
        if (
          String(command.status || '')
            .trim()
            .toLowerCase() !== 'queued'
        ) {
          return;
        }

        settle(command);
      });
      cleanupCallbacks.push(unsubscribe);

      const timeout = setTimeout(() => {
        settle(null);
      }, normalizedTimeoutMs);
      cleanupCallbacks.push(() => clearTimeout(timeout));

      loadNextQueuedCommand()
        .then((existingCommand) => {
          if (existingCommand) {
            settle(existingCommand);
          }
        })
        .catch((error) => {
          settle(null, error);
        });
    });
  }

  return {
    dispatchCommand,
    getCommandStatus,
    updateCommandStatus,
    listAgentCommands,
    waitForNextAgentCommand,
    ensureAgentAccess,
  };
}

module.exports = {
  createVmOpsService,
  VmOpsServiceError,
};
