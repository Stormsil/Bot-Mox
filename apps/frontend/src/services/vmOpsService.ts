import {
  createAgentPairingViaContract,
  listAgentsViaContract,
} from '../providers/vmops-contract-client';
import { ApiClientError } from './apiClient';
import { dispatchAndPoll } from './vmOps/commandExecution';
import {
  type AgentPairingRecord,
  type AgentSummary,
  toAgentPairingRecord,
  toAgentSummaryList,
} from './vmOps/parsers';
import {
  getSelectedProxmoxTargetId,
  getSelectedProxmoxTargetNode,
  setSelectedProxmoxTargetId,
  setSelectedProxmoxTargetNode,
} from './vmOps/targetStorage';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type { AgentPairingRecord };
export type { AgentPairingDefaults } from './vmOps/parsers';
export {
  getSelectedProxmoxTargetId,
  getSelectedProxmoxTargetNode,
  setSelectedProxmoxTargetId,
  setSelectedProxmoxTargetNode,
};

// ---------------------------------------------------------------------------
// Agent discovery
// ---------------------------------------------------------------------------

const AGENT_ONLINE_WINDOW_MS = 120_000;
const AGENT_CACHE_TTL_MS = 10_000;
const AGENT_NULL_CACHE_TTL_MS = 2_000;
const DEDUPED_VM_OPS = new Set([
  'proxmox.status',
  'proxmox.ssh-status',
  'proxmox.ssh-test',
  'proxmox.list-vms',
  'proxmox.list-targets',
  'proxmox.cluster-resources',
  'proxmox.get-config',
  'proxmox.vm-status',
]);
const AGENT_UNAVAILABLE_BACKOFF_MS = 3_000;

let cachedAgentId: string | null = null;
let cachedAgentExpiresAtMs = 0;
const inFlightVmOps = new Map<string, Promise<unknown>>();
let agentUnavailableUntilMs = 0;
let inFlightAgentLookup: Promise<string | null> | null = null;

function parseTimestampMs(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function isAgentOnline(agent: AgentSummary, nowMs = Date.now()): boolean {
  if (
    String(agent.status || '')
      .trim()
      .toLowerCase() !== 'active'
  ) {
    return false;
  }
  const lastSeenAtMs = parseTimestampMs(agent.last_seen_at);
  if (lastSeenAtMs <= 0) {
    return false;
  }
  return nowMs - lastSeenAtMs < AGENT_ONLINE_WINDOW_MS;
}

function hasFreshAgentCache(nowMs = Date.now()): boolean {
  return cachedAgentExpiresAtMs > nowMs;
}

function setCachedAgentId(agentId: string | null): void {
  cachedAgentId = agentId;
  cachedAgentExpiresAtMs = Date.now() + (agentId ? AGENT_CACHE_TTL_MS : AGENT_NULL_CACHE_TTL_MS);
}

async function lookupActiveAgentId(): Promise<string | null> {
  try {
    const { data } = await listAgentsViaContract({ status: 'active' });
    const agents = toAgentSummaryList(data);
    const nowMs = Date.now();
    const online = agents
      .filter((agent) => isAgentOnline(agent, nowMs))
      .sort(
        (first, second) =>
          parseTimestampMs(second.last_seen_at) - parseTimestampMs(first.last_seen_at),
      )[0];
    if (online) {
      setCachedAgentId(online.id);
      return online.id;
    }
  } catch {
    // Agent list unavailable — fall through.
  }

  setCachedAgentId(null);
  return null;
}

/**
 * Get the first online agent for the current tenant.
 * Caches the result for the session to avoid repeated queries.
 */
export async function getActiveAgentId(
  options: { forceRefresh?: boolean } = {},
): Promise<string | null> {
  const forceRefresh = options.forceRefresh === true;
  if (!forceRefresh && hasFreshAgentCache()) {
    return cachedAgentId;
  }

  if (inFlightAgentLookup) {
    return inFlightAgentLookup;
  }

  const lookupPromise = lookupActiveAgentId();
  inFlightAgentLookup = lookupPromise;
  try {
    return await lookupPromise;
  } finally {
    if (inFlightAgentLookup === lookupPromise) {
      inFlightAgentLookup = null;
    }
  }
}

export function clearAgentCache(): void {
  cachedAgentId = null;
  cachedAgentExpiresAtMs = 0;
  inFlightAgentLookup = null;
}

function shouldRetryWithFreshAgent(error: unknown): boolean {
  if (!(error instanceof ApiClientError)) {
    return false;
  }

  return new Set([
    'AGENT_OFFLINE',
    'AGENT_NOT_FOUND',
    'AGENT_OWNER_UNASSIGNED',
    'AGENT_OWNER_MISMATCH',
  ]).has(String(error.code || '').trim());
}

function isAgentOfflineError(error: unknown): boolean {
  return error instanceof ApiClientError && String(error.code || '').trim() === 'AGENT_OFFLINE';
}

function hasAgentUnavailableBackoff(nowMs = Date.now()): boolean {
  return agentUnavailableUntilMs > nowMs;
}

function setAgentUnavailableBackoff(durationMs = AGENT_UNAVAILABLE_BACKOFF_MS): void {
  agentUnavailableUntilMs = Date.now() + Math.max(1_000, durationMs);
}

function clearAgentUnavailableBackoff(): void {
  agentUnavailableUntilMs = 0;
}

function buildDedupeKey(
  params: {
    type: 'proxmox' | 'syncthing';
    action: string;
    params?: Record<string, unknown>;
  },
  agentId: string,
): string | null {
  const opKey = `${params.type}.${params.action}`;
  if (!DEDUPED_VM_OPS.has(opKey)) {
    return null;
  }

  const payload = params.params && typeof params.params === 'object' ? params.params : {};
  return `${agentId}|${opKey}|${JSON.stringify(payload)}`;
}

export async function createAgentPairing(params?: {
  name?: string;
  expiresInMinutes?: number;
}): Promise<AgentPairingRecord> {
  const payload: {
    name?: string;
    expires_in_minutes?: number;
  } = {};
  if (params?.name && String(params.name).trim()) {
    payload.name = String(params.name).trim();
  }
  if (typeof params?.expiresInMinutes === 'number' && Number.isFinite(params.expiresInMinutes)) {
    payload.expires_in_minutes = Math.max(5, Math.min(1_440, Math.trunc(params.expiresInMinutes)));
  }

  const { data } = await createAgentPairingViaContract(payload);
  return toAgentPairingRecord(data);
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
  const selectedProxmoxTargetId = params.type === 'proxmox' ? getSelectedProxmoxTargetId() : null;
  const selectedProxmoxTargetNode =
    params.type === 'proxmox' ? getSelectedProxmoxTargetNode() : null;

  const commandParams = (() => {
    const source = params.params && typeof params.params === 'object' ? params.params : {};
    if (!selectedProxmoxTargetId) {
      return source;
    }
    if (params.action === 'list-targets') {
      return source;
    }
    return {
      ...source,
      target: selectedProxmoxTargetId,
      ...(selectedProxmoxTargetNode ? { node: selectedProxmoxTargetNode } : {}),
    };
  })();

  const run = async (): Promise<T> => {
    const backoffActiveAtStart = hasAgentUnavailableBackoff();

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const forceRefresh = attempt > 0 || backoffActiveAtStart;
      const agentId = await getActiveAgentId({ forceRefresh });
      if (!agentId) {
        if (attempt === 0) {
          clearAgentCache();
          setAgentUnavailableBackoff();
          continue;
        }
        setAgentUnavailableBackoff();
        throw new ApiClientError(
          'Agent is currently offline or reconnecting. Please retry in a few seconds.',
          {
            status: 409,
            code: 'AGENT_OFFLINE',
            details: { reason: 'NO_ACTIVE_AGENT' },
          },
        );
      }

      const dedupeKey = buildDedupeKey({ ...params, params: commandParams }, agentId);
      if (dedupeKey) {
        const existing = inFlightVmOps.get(dedupeKey);
        if (existing) {
          return existing as Promise<T>;
        }
      }

      const requestPromise = dispatchAndPoll<T>({
        ...params,
        params: commandParams,
        agentId,
      });
      if (dedupeKey) {
        inFlightVmOps.set(dedupeKey, requestPromise);
      }

      try {
        const result = await requestPromise;
        clearAgentUnavailableBackoff();
        return result;
      } catch (error) {
        if (isAgentOfflineError(error)) {
          setAgentUnavailableBackoff();
        }
        if (attempt === 0 && shouldRetryWithFreshAgent(error)) {
          clearAgentCache();
          continue;
        }
        throw error;
      } finally {
        if (dedupeKey && inFlightVmOps.get(dedupeKey) === requestPromise) {
          inFlightVmOps.delete(dedupeKey);
        }
      }
    }

    throw new Error('Failed to resolve active agent');
  };

  return run();
}
