import { apiGet, apiPost } from './apiClient';

const VM_OPS_PREFIX = '/api/v1/vm-ops';
const AGENTS_PREFIX = '/api/v1/agents';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CommandEnvelope {
  id: string;
  tenant_id: string;
  agent_id: string;
  command_type: string;
  status: string;
  queued_at: string;
  expires_at: string;
}

interface CommandStatus extends CommandEnvelope {
  result?: unknown;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
}

interface AgentSummary {
  id: string;
  name: string;
  status: string;
  last_seen_at: string | null;
}

// ---------------------------------------------------------------------------
// Agent discovery
// ---------------------------------------------------------------------------

let cachedAgentId: string | null = null;

/**
 * Get the first online agent for the current tenant.
 * Caches the result for the session to avoid repeated queries.
 */
export async function getActiveAgentId(): Promise<string | null> {
  if (cachedAgentId) return cachedAgentId;

  try {
    const { data } = await apiGet<AgentSummary[]>(`${AGENTS_PREFIX}?status=active`);
    const agents = Array.isArray(data) ? data : [];
    const online = agents.find(
      (a) => a.status === 'active' && a.last_seen_at,
    );
    if (online) {
      cachedAgentId = online.id;
      return online.id;
    }
  } catch {
    // Agent list unavailable — fall through.
  }

  return null;
}

export function clearAgentCache(): void {
  cachedAgentId = null;
}

// ---------------------------------------------------------------------------
// Command dispatch + poll
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const TERMINAL_STATES = new Set(['succeeded', 'failed', 'expired', 'cancelled']);

export async function dispatchAndPoll<T = unknown>(params: {
  type: 'proxmox' | 'syncthing';
  action: string;
  agentId: string;
  params?: Record<string, unknown>;
  timeoutMs?: number;
  pollIntervalMs?: number;
}): Promise<T> {
  const { data: cmd } = await apiPost<CommandEnvelope>(
    `${VM_OPS_PREFIX}/${params.type}/${params.action}`,
    { agent_id: params.agentId, params: params.params },
  );

  const timeout = params.timeoutMs ?? 120_000;
  const interval = params.pollIntervalMs ?? 2_000;
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    await sleep(interval);

    const { data: status } = await apiGet<CommandStatus>(
      `${VM_OPS_PREFIX}/commands/${cmd.id}`,
    );

    if (!TERMINAL_STATES.has(status.status)) continue;

    if (status.status === 'succeeded') return status.result as T;
    if (status.status === 'failed') {
      throw new Error(status.error_message || 'Command failed');
    }
    throw new Error(`Command ${status.status}`);
  }

  throw new Error('Command timed out');
}

/**
 * High-level helper: resolve agent, dispatch command, poll for result.
 * Throws if no agent is available.
 */
export async function executeVmOps<T = unknown>(params: {
  type: 'proxmox' | 'syncthing';
  action: string;
  params?: Record<string, unknown>;
  timeoutMs?: number;
}): Promise<T> {
  const agentId = await getActiveAgentId();
  if (!agentId) {
    throw new Error(
      'No active agent found. VM operations require a connected agent.',
    );
  }
  return dispatchAndPoll<T>({ ...params, agentId });
}
