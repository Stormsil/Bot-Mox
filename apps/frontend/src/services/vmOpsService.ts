import {
  createAgentPairingViaContract,
  dispatchVmOpsViaContract,
  getVmOpsCommandViaContract,
  listAgentsViaContract,
} from '../providers/vmops-contract-client';
import { ApiClientError } from './apiClient';
import { subscribeToVmOpsEvents, type VmOpsCommandEvent } from './vmOpsEventsService';

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
  payload?: Record<string, unknown>;
  result?: unknown;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  created_by?: string | null;
}

interface AgentSummary {
  id: string;
  name: string;
  status: string;
  last_seen_at: string | null;
}

const PROXMOX_TARGET_STORAGE_KEY = 'botmox.proxmox.target.id';
const PROXMOX_TARGET_NODE_STORAGE_KEY = 'botmox.proxmox.target.node';

export interface AgentPairingDefaults {
  url?: string;
  username?: string;
  node?: string;
}

export interface AgentPairingRecord {
  id: string;
  tenant_id: string;
  name: string;
  status: string;
  pairing_code: string;
  pairing_expires_at: string;
  pairing_bundle?: string;
  pairing_uri?: string;
  pairing_url?: string;
  server_url?: string;
  proxmox_defaults?: AgentPairingDefaults;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asOptionalString(value: unknown): string | undefined {
  const normalized = asString(value).trim();
  return normalized ? normalized : undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function toAgentSummaryList(payload: unknown): AgentSummary[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((item) => {
      const record = asRecord(item);
      const id = asString(record.id).trim();
      if (!id) {
        return null;
      }

      const name = asString(record.name).trim() || id;
      const status = asString(record.status).trim();
      const lastSeenAtRaw = record.last_seen_at;
      const last_seen_at =
        typeof lastSeenAtRaw === 'string' && lastSeenAtRaw.trim() ? lastSeenAtRaw : null;

      return {
        id,
        name,
        status,
        last_seen_at,
      };
    })
    .filter((item): item is AgentSummary => item !== null);
}

function toAgentPairingRecord(payload: unknown): AgentPairingRecord {
  const record = asRecord(payload);
  const id = asString(record.id).trim();
  const tenant_id = asString(record.tenant_id).trim();
  const name = asString(record.name).trim();
  const status = asString(record.status).trim();
  const pairing_code = asString(record.pairing_code).trim();
  const pairing_expires_at = asString(record.pairing_expires_at).trim();

  if (!id || !pairing_code) {
    throw new ApiClientError('Invalid pairing response payload', {
      status: 500,
      code: 'INVALID_RESPONSE',
      details: payload,
    });
  }

  const proxmoxDefaults = asRecord(record.proxmox_defaults);
  const proxmox_defaults =
    Object.keys(proxmoxDefaults).length > 0
      ? {
          url: asOptionalString(proxmoxDefaults.url),
          username: asOptionalString(proxmoxDefaults.username),
          node: asOptionalString(proxmoxDefaults.node),
        }
      : undefined;

  return {
    id,
    tenant_id,
    name,
    status,
    pairing_code,
    pairing_expires_at,
    pairing_bundle: asOptionalString(record.pairing_bundle),
    pairing_uri: asOptionalString(record.pairing_uri),
    pairing_url: asOptionalString(record.pairing_url),
    server_url: asOptionalString(record.server_url),
    proxmox_defaults,
  };
}

function toCommandStatus(payload: unknown): CommandStatus {
  const record = asRecord(payload);
  const id = asString(record.id).trim();
  const status = asString(record.status).trim();
  const command_type = asString(record.command_type).trim();
  const tenant_id = asString(record.tenant_id).trim();
  const agent_id = asString(record.agent_id).trim();
  const queued_at = asString(record.queued_at).trim();
  const expires_at = asString(record.expires_at).trim();

  if (!id || !status || !command_type) {
    throw new ApiClientError('Invalid VM ops command payload', {
      status: 500,
      code: 'INVALID_RESPONSE',
      details: payload,
    });
  }

  return {
    id,
    status,
    command_type,
    tenant_id,
    agent_id,
    queued_at,
    expires_at,
    payload:
      record.payload && typeof record.payload === 'object'
        ? (record.payload as Record<string, unknown>)
        : undefined,
    result: record.result,
    error_message: asOptionalString(record.error_message),
    started_at: asOptionalString(record.started_at),
    completed_at: asOptionalString(record.completed_at),
    created_by: asOptionalString(record.created_by) ?? null,
  };
}

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
const inFlightCommandWaits = new Map<string, Promise<unknown>>();
let agentUnavailableUntilMs = 0;
let inFlightAgentLookup: Promise<string | null> | null = null;

function canUseLocalStorage(): boolean {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}

export function getSelectedProxmoxTargetId(): string | null {
  if (!canUseLocalStorage()) return null;
  const value = String(window.localStorage.getItem(PROXMOX_TARGET_STORAGE_KEY) || '').trim();
  return value || null;
}

export function getSelectedProxmoxTargetNode(): string | null {
  if (!canUseLocalStorage()) return null;
  const value = String(window.localStorage.getItem(PROXMOX_TARGET_NODE_STORAGE_KEY) || '').trim();
  return value || null;
}

export function setSelectedProxmoxTargetId(targetId: string | null): void {
  if (!canUseLocalStorage()) return;
  const normalized = String(targetId || '').trim();
  if (!normalized) {
    window.localStorage.removeItem(PROXMOX_TARGET_STORAGE_KEY);
    window.localStorage.removeItem(PROXMOX_TARGET_NODE_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(PROXMOX_TARGET_STORAGE_KEY, normalized);
}

export function setSelectedProxmoxTargetNode(node: string | null): void {
  if (!canUseLocalStorage()) return;
  const normalized = String(node || '').trim();
  if (!normalized) {
    window.localStorage.removeItem(PROXMOX_TARGET_NODE_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(PROXMOX_TARGET_NODE_STORAGE_KEY, normalized);
}

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

// ---------------------------------------------------------------------------
// Command dispatch + poll
// ---------------------------------------------------------------------------

const TERMINAL_STATES = new Set(['succeeded', 'failed', 'expired', 'cancelled']);
const VM_OPS_WAIT_TIMEOUT_MS = 120_000;
const VM_OPS_STATUS_POLL_INTERVAL_MS = 1_500;

function commandErrorFromStatus(status: CommandStatus): Error {
  const statusValue = String(status.status || '')
    .trim()
    .toLowerCase();
  if (statusValue === 'failed') {
    const rawMessage = String(status.error_message || 'Command failed').trim();
    const tagged = rawMessage.match(/^([A-Z_]+):\s*(.+)$/);
    if (tagged) {
      return new ApiClientError(tagged[2], {
        status: 409,
        code: tagged[1],
        details: {
          command_id: status.id,
          command_type: status.command_type,
        },
      });
    }
    return new Error(rawMessage || 'Command failed');
  }
  return new Error(`Command ${statusValue || 'unknown'}`);
}

async function fetchCommandStatus(commandId: string): Promise<CommandStatus> {
  const { data } = await getVmOpsCommandViaContract(commandId);
  return toCommandStatus(data);
}

function isTerminalStatus(status: string): boolean {
  return TERMINAL_STATES.has(
    String(status || '')
      .trim()
      .toLowerCase(),
  );
}

async function waitForCommandTerminal<T>(params: {
  commandId: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
  agentId?: string;
}): Promise<T> {
  const commandId = String(params.commandId || '').trim();
  if (!commandId) {
    throw new Error('commandId is required');
  }

  const existingWait = inFlightCommandWaits.get(commandId);
  if (existingWait) {
    return existingWait as Promise<T>;
  }

  const waitPromise = (async (): Promise<T> => {
    const timeoutMs = params.timeoutMs ?? VM_OPS_WAIT_TIMEOUT_MS;
    const pollIntervalMs = Math.max(
      500,
      Math.min(10_000, Math.trunc(params.pollIntervalMs ?? VM_OPS_STATUS_POLL_INTERVAL_MS)),
    );
    const initialStatus = await fetchCommandStatus(commandId);
    if (isTerminalStatus(initialStatus.status)) {
      if (initialStatus.status === 'succeeded') {
        return initialStatus.result as T;
      }
      throw commandErrorFromStatus(initialStatus);
    }

    return new Promise<T>((resolve, reject) => {
      let settled = false;
      let pollTimer: ReturnType<typeof setTimeout> | null = null;

      const cleanupCallbacks: Array<() => void> = [];
      const cleanup = () => {
        cleanupCallbacks.forEach((fn) => {
          try {
            fn();
          } catch {
            // noop
          }
        });
        cleanupCallbacks.length = 0;
      };

      const settle = (handler: () => void) => {
        if (settled) return;
        settled = true;
        cleanup();
        handler();
      };

      const handleTerminalStatus = (status: CommandStatus) => {
        settle(() => {
          if (status.status === 'succeeded') {
            resolve(status.result as T);
            return;
          }
          reject(commandErrorFromStatus(status));
        });
      };

      const pollCommandStatus = async () => {
        if (settled) return;
        try {
          const status = await fetchCommandStatus(commandId);
          if (isTerminalStatus(status.status)) {
            handleTerminalStatus(status);
            return;
          }
        } catch {
          // Ignore transient poll errors; timeout handler will do final check.
        }
        if (!settled) {
          pollTimer = globalThis.setTimeout(() => {
            pollTimer = null;
            void pollCommandStatus();
          }, pollIntervalMs);
        }
      };

      cleanupCallbacks.push(() => {
        if (pollTimer) {
          globalThis.clearTimeout(pollTimer);
          pollTimer = null;
        }
      });

      const unsubscribe = subscribeToVmOpsEvents(
        (event: VmOpsCommandEvent) => {
          const command = event.command;
          if (String(command.id || '').trim() !== commandId) {
            return;
          }
          if (!isTerminalStatus(command.status)) {
            return;
          }

          handleTerminalStatus(command as CommandStatus);
        },
        undefined,
        { agentId: params.agentId, commandId },
      );
      cleanupCallbacks.push(unsubscribe);

      pollTimer = globalThis.setTimeout(
        () => {
          pollTimer = null;
          void pollCommandStatus();
        },
        Math.min(300, pollIntervalMs),
      );

      const timeout = globalThis.setTimeout(async () => {
        try {
          const status = await fetchCommandStatus(commandId);
          settle(() => {
            if (status.status === 'succeeded') {
              resolve(status.result as T);
              return;
            }
            if (isTerminalStatus(status.status)) {
              reject(commandErrorFromStatus(status));
              return;
            }
            reject(new Error('Command timed out'));
          });
        } catch (error) {
          settle(() => {
            reject(error instanceof Error ? error : new Error('Command timed out'));
          });
        }
      }, timeoutMs);
      cleanupCallbacks.push(() => globalThis.clearTimeout(timeout));
    });
  })();

  inFlightCommandWaits.set(commandId, waitPromise);
  try {
    return await waitPromise;
  } finally {
    if (inFlightCommandWaits.get(commandId) === waitPromise) {
      inFlightCommandWaits.delete(commandId);
    }
  }
}

export async function dispatchAndPoll<T = unknown>(params: {
  type: 'proxmox' | 'syncthing';
  action: string;
  agentId: string;
  params?: Record<string, unknown>;
  timeoutMs?: number;
  pollIntervalMs?: number;
}): Promise<T> {
  const { data: cmd } = await dispatchVmOpsViaContract(params.type, params.action, {
    agent_id: params.agentId,
    params: params.params,
  });
  const command = toCommandStatus(cmd);

  return waitForCommandTerminal<T>({
    commandId: command.id,
    timeoutMs: params.timeoutMs,
    pollIntervalMs: params.pollIntervalMs,
    agentId: params.agentId,
  });
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
