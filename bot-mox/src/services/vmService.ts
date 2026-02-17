import type {
  ProxmoxVM,
  ProxmoxClusterResource,
  CloneParams,
  ProxmoxTaskStatus,
  SSHResult,
  ProxmoxVMConfig,
  VMConfigUpdateParams,
} from '../types';
import { apiPost, ApiClientError } from './apiClient';
import { executeVmOps } from './vmOpsService';

export interface ProxmoxTargetInfo {
  id: string;
  label: string;
  url: string;
  username: string;
  node: string;
  isActive?: boolean;
  sshConfigured?: boolean;
}

const AGENT_CONNECTIVITY_ERROR_CODES = new Set([
  'AGENT_OFFLINE',
  'AGENT_NOT_FOUND',
  'AGENT_OWNER_UNASSIGNED',
  'AGENT_OWNER_MISMATCH',
]);

export interface ProxmoxConnectionSnapshot {
  agentOnline: boolean;
  proxmoxConnected: boolean;
}

export interface SshConnectionStatus {
  connected: boolean;
  configured: boolean;
  code?: string;
  message?: string;
  mode?: string;
  host?: string;
  port?: number;
  username?: string;
}

const SSH_STATUS_CACHE_TTL_MS = 3_000;
let cachedSshStatus: { expiresAtMs: number; value: SshConnectionStatus } | null = null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRunningStatus(status: unknown): boolean {
  return String(status || '').toLowerCase() === 'running';
}

function extractUpid(value: unknown, depth = 0): string {
  if (depth > 6 || value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    const normalized = value.trim();
    if (!normalized || normalized === '[object Object]') {
      return '';
    }
    const match = normalized.match(/UPID:[^\s'"]+/i);
    return match ? match[0] : normalized;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const extracted = extractUpid(item, depth + 1);
      if (extracted) return extracted;
    }
    return '';
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const candidates: unknown[] = [
      record.upid,
      record.UPID,
      record.task,
      record.taskId,
      record.task_id,
      record.id,
      record.value,
      record.data,
      record.result,
    ];

    for (const candidate of candidates) {
      const extracted = extractUpid(candidate, depth + 1);
      if (extracted) return extracted;
    }
    return '';
  }

  return '';
}

// ============================================================
// Proxmox operations (via agent command bus → /api/v1/vm-ops)
// ============================================================

export async function testProxmoxConnection(): Promise<boolean> {
  const snapshot = await getProxmoxConnectionSnapshot();
  return snapshot.proxmoxConnected;
}

export async function getProxmoxConnectionSnapshot(): Promise<ProxmoxConnectionSnapshot> {
  try {
    const result = await executeVmOps<{ connected?: boolean }>({
      type: 'proxmox',
      action: 'status',
      timeoutMs: 15_000,
    });
    return {
      agentOnline: true,
      proxmoxConnected: Boolean(result?.connected),
    };
  } catch (error) {
    if (error instanceof ApiClientError && AGENT_CONNECTIVITY_ERROR_CODES.has(String(error.code || '').trim())) {
      return {
        agentOnline: false,
        proxmoxConnected: false,
      };
    }

    return {
      agentOnline: false,
      proxmoxConnected: false,
    };
  }
}

export async function listProxmoxTargets(): Promise<ProxmoxTargetInfo[]> {
  const result = await executeVmOps<ProxmoxTargetInfo[]>({
    type: 'proxmox',
    action: 'list-targets',
    timeoutMs: 10_000,
  });
  return Array.isArray(result) ? result : [];
}

export async function proxmoxLogin(): Promise<boolean> {
  try {
    await executeVmOps({ type: 'proxmox', action: 'login' });
    return true;
  } catch {
    return false;
  }
}

export async function listVMs(node = 'h1'): Promise<ProxmoxVM[]> {
  const result = await executeVmOps<ProxmoxVM[]>({
    type: 'proxmox',
    action: 'list-vms',
    params: { node },
  });
  return Array.isArray(result) ? result : [];
}

export async function getClusterResources(
  resourceType: string = 'storage'
): Promise<ProxmoxClusterResource[]> {
  const result = await executeVmOps<ProxmoxClusterResource[]>({
    type: 'proxmox',
    action: 'cluster-resources',
    params: { type: resourceType },
  });
  return Array.isArray(result) ? result : [];
}

export async function cloneVM(params: CloneParams): Promise<{ upid: string }> {
  const result = await executeVmOps<{ upid: string }>({
    type: 'proxmox',
    action: 'clone',
    params: {
      templateVmId: params.templateVmId,
      newid: params.newid,
      name: params.name,
      storage: params.storage,
      format: params.format,
      full: params.full,
      node: params.node,
    },
    timeoutMs: 300_000,
  });
  const upid = extractUpid(result?.upid ?? result);
  if (!upid) throw new Error('Clone completed without UPID');
  return { upid };
}

export async function resizeVMDisk(params: {
  vmid: number;
  node?: string;
  disk: string;
  size: string;
}): Promise<{ upid: string | null }> {
  const result = await executeVmOps<{ upid?: string }>({
    type: 'proxmox',
    action: 'resize-disk',
    params: {
      vmid: params.vmid,
      node: params.node,
      disk: params.disk,
      size: params.size,
    },
    timeoutMs: 120_000,
  });
  const upid = extractUpid(result?.upid ?? result);
  return { upid: upid || null };
}

export async function pollTaskStatus(upid: unknown, node = 'h1'): Promise<ProxmoxTaskStatus> {
  const normalizedUpid = extractUpid(upid);
  if (!normalizedUpid) {
    throw new Error('Task status requested without a valid UPID');
  }
  const result = await executeVmOps<ProxmoxTaskStatus>({
    type: 'proxmox',
    action: 'task-status',
    params: { upid: normalizedUpid, node },
    timeoutMs: 15_000,
  });
  return result;
}

export async function waitForTask(
  upid: unknown,
  node = 'h1',
  options: { timeoutMs?: number; intervalMs?: number } = {}
): Promise<ProxmoxTaskStatus> {
  const normalizedUpid = extractUpid(upid);
  if (!normalizedUpid) {
    throw new Error('Task wait requested without a valid UPID');
  }
  const timeoutMs = Math.max(1_000, Math.trunc(options.timeoutMs ?? 300_000));
  const intervalMs = Math.max(250, Math.trunc(options.intervalMs ?? 1_000));
  const result = await executeVmOps<ProxmoxTaskStatus>({
    type: 'proxmox',
    action: 'wait-task',
    params: { upid: normalizedUpid, node, timeoutMs, intervalMs },
    timeoutMs: timeoutMs + 30_000,
  });
  return result;
}

export async function startVM(vmid: number, node = 'h1'): Promise<string | null> {
  const result = await executeVmOps<{ upid?: string }>({
    type: 'proxmox',
    action: 'start',
    params: { vmid, node },
    timeoutMs: 30_000,
  });
  return extractUpid(result?.upid ?? result) || null;
}

export async function stopVM(vmid: number, node = 'h1'): Promise<void> {
  await executeVmOps({
    type: 'proxmox',
    action: 'stop',
    params: { vmid, node },
    timeoutMs: 30_000,
  });
}

export interface DeleteVMOptions {
  purge?: boolean;
  destroyUnreferencedDisks?: boolean;
}

export async function deleteVM(
  vmid: number,
  node = 'h1',
  options: DeleteVMOptions = {}
): Promise<{ upid: string | null }> {
  const result = await executeVmOps<{ upid?: string }>({
    type: 'proxmox',
    action: 'delete',
    params: {
      vmid,
      node,
      purge: options.purge ?? true,
      destroyUnreferencedDisks: options.destroyUnreferencedDisks ?? true,
    },
    timeoutMs: 60_000,
  });
  return { upid: extractUpid(result?.upid ?? result) || null };
}

export async function getVMStatus(vmid: number, node = 'h1'): Promise<ProxmoxVM> {
  return executeVmOps<ProxmoxVM>({
    type: 'proxmox',
    action: 'vm-status',
    params: { vmid, node },
    timeoutMs: 15_000,
  });
}

export async function waitForVmStatus(
  vmid: number,
  node = 'h1',
  desiredStatus = 'running',
  options: { timeoutMs?: number; intervalMs?: number } = {}
): Promise<ProxmoxVM> {
  const timeoutMs = Math.max(1_000, Math.trunc(options.timeoutMs ?? 120_000));
  const intervalMs = Math.max(250, Math.trunc(options.intervalMs ?? 1_000));
  return executeVmOps<ProxmoxVM>({
    type: 'proxmox',
    action: 'wait-vm-status',
    params: { vmid, node, desiredStatus, timeoutMs, intervalMs },
    timeoutMs: timeoutMs + 30_000,
  });
}

export async function waitForVmPresence(
  vmid: number,
  node = 'h1',
  exists = true,
  options: { timeoutMs?: number; intervalMs?: number } = {}
): Promise<{ vmid: number; exists: boolean }> {
  const timeoutMs = Math.max(1_000, Math.trunc(options.timeoutMs ?? 45_000));
  const intervalMs = Math.max(250, Math.trunc(options.intervalMs ?? 1_000));
  return executeVmOps<{ vmid: number; exists: boolean }>({
    type: 'proxmox',
    action: 'wait-vm-presence',
    params: { vmid, node, exists, timeoutMs, intervalMs },
    timeoutMs: timeoutMs + 30_000,
  });
}

export async function sendVMKey(vmid: number, key: string, node = 'h1'): Promise<void> {
  const normalizedKey = String(key || '').trim();
  if (!normalizedKey) throw new Error('key is required');
  await executeVmOps({
    type: 'proxmox',
    action: 'sendkey',
    params: { vmid, key: normalizedKey, node },
    timeoutMs: 15_000,
  });
}

export interface StartAndSendKeyOptions {
  node?: string;
  key?: string;
  repeatCount?: number;
  intervalMs?: number;
  startupDelayMs?: number;
  waitTimeoutMs?: number;
  pollIntervalMs?: number;
}

export interface StartAndSendKeyResultItem {
  vmid: number;
  success: boolean;
  error?: string;
}

export interface StartAndSendKeyBatchResult {
  total: number;
  ok: number;
  failed: number;
  results: StartAndSendKeyResultItem[];
}

interface SendKeySpamResult {
  attempts: number;
  sent: number;
  lastError: string | null;
}

async function waitUntilVmRunning(
  vmid: number,
  node: string,
  timeoutMs: number,
  pollIntervalMs: number
): Promise<void> {
  const status = await waitForVmStatus(vmid, node, 'running', {
    timeoutMs,
    intervalMs: pollIntervalMs,
  });
  if (!isRunningStatus(status.status)) {
    throw new Error(`VM ${vmid} did not reach running state within ${Math.ceil(timeoutMs / 1000)}s`);
  }
}

async function waitForTaskCompletion(
  upid: string,
  node: string,
  timeoutMs: number,
  pollIntervalMs: number,
  taskLabel: string
): Promise<void> {
  const status = await waitForTask(upid, node, {
    timeoutMs,
    intervalMs: pollIntervalMs,
  });
  const exitStatus = String(status?.exitstatus || '').trim();
  if (exitStatus && exitStatus.toUpperCase() !== 'OK') {
    throw new Error(`${taskLabel} failed: ${exitStatus}`);
  }
}

async function runSendKeySpam(
  vmid: number,
  options: Required<Pick<StartAndSendKeyOptions,
  'node' | 'key' | 'repeatCount' | 'intervalMs' | 'startupDelayMs'>>,
  signal: { cancelled: boolean }
): Promise<SendKeySpamResult> {
  if (options.startupDelayMs > 0) {
    await sleep(options.startupDelayMs);
  }

  let sent = 0;
  let lastError: string | null = null;

  for (let i = 0; i < options.repeatCount; i++) {
    if (signal.cancelled) break;
    try {
      await sendVMKey(vmid, options.key, options.node);
      sent += 1;
      lastError = null;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    if (i < options.repeatCount - 1 && options.intervalMs > 0) {
      await sleep(options.intervalMs);
    }
  }

  return {
    attempts: options.repeatCount,
    sent,
    lastError,
  };
}

async function runStartAndSendKeyForVm(
  vmid: number,
  options: Required<Pick<StartAndSendKeyOptions,
  'node' | 'key' | 'repeatCount' | 'intervalMs' | 'startupDelayMs' | 'waitTimeoutMs' | 'pollIntervalMs'>>
): Promise<void> {
  let isAlreadyRunning = false;
  try {
    const current = await getVMStatus(vmid, options.node);
    isAlreadyRunning = isRunningStatus(current.status);
  } catch {
    // Ignore
  }

  const spamSignal = { cancelled: false };
  const sendKeySpamPromise = runSendKeySpam(vmid, options, spamSignal);

  try {
    if (!isAlreadyRunning) {
      let startUpid: string | null = null;
      try {
        startUpid = await startVM(vmid, options.node);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (/already running|status: running|state is running|vm is running/i.test(msg)) {
          isAlreadyRunning = true;
        } else {
          throw error;
        }
      }

      if (!isAlreadyRunning && startUpid) {
        await waitForTaskCompletion(
          startUpid,
          options.node,
          Math.max(options.waitTimeoutMs, 180000),
          options.pollIntervalMs,
          `VM ${vmid} start task`
        );
      }
    }

    await waitUntilVmRunning(vmid, options.node, options.waitTimeoutMs, options.pollIntervalMs);

    const spamResult = await sendKeySpamPromise;
    if (spamResult.sent === 0) {
      const lastErrorSuffix = spamResult.lastError ? ` Last error: ${spamResult.lastError}` : '';
      throw new Error(
        `VM ${vmid} did not accept key "${options.key}" during ${spamResult.attempts} attempts.${lastErrorSuffix}`
      );
    }
  } catch (error) {
    spamSignal.cancelled = true;
    await sendKeySpamPromise;
    throw error;
  }
}

export async function startAndSendKeyBatch(
  vmIds: number[],
  options: StartAndSendKeyOptions = {}
): Promise<StartAndSendKeyBatchResult> {
  const normalizedVmIds = Array.from(new Set(
    (vmIds || [])
      .map(id => Number(id))
      .filter(id => Number.isInteger(id) && id > 0)
  ));

  if (normalizedVmIds.length === 0) {
    throw new Error('No VM IDs provided');
  }

  const effectiveOptions = {
    node: options.node || 'h1',
    key: (options.key || 'a').trim() || 'a',
    repeatCount: Math.max(1, Math.trunc(options.repeatCount ?? 10)),
    intervalMs: Math.max(0, Math.trunc(options.intervalMs ?? 1000)),
    startupDelayMs: Math.max(0, Math.trunc(options.startupDelayMs ?? 3000)),
    waitTimeoutMs: Math.max(1000, Math.trunc(options.waitTimeoutMs ?? 120000)),
    pollIntervalMs: Math.max(250, Math.trunc(options.pollIntervalMs ?? 1000)),
  };

  const results = await Promise.all(
    normalizedVmIds.map(async (vmid): Promise<StartAndSendKeyResultItem> => {
      try {
        await runStartAndSendKeyForVm(vmid, effectiveOptions);
        return { vmid, success: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { vmid, success: false, error: message };
      }
    })
  );

  const ok = results.filter(item => item.success).length;
  return {
    total: results.length,
    ok,
    failed: results.length - ok,
    results,
  };
}

export async function getVMConfig(vmid: number, node = 'h1'): Promise<ProxmoxVMConfig> {
  return executeVmOps<ProxmoxVMConfig>({
    type: 'proxmox',
    action: 'get-config',
    params: { vmid, node },
    timeoutMs: 15_000,
  });
}

export async function updateVMConfig(params: VMConfigUpdateParams): Promise<{ upid: string | null }> {
  const result = await executeVmOps<{ upid?: string }>({
    type: 'proxmox',
    action: 'update-config',
    params: {
      vmid: params.vmid,
      node: params.node,
      cores: params.cores,
      sockets: params.sockets,
      memory: params.memory,
      balloon: params.balloon,
      cpu: params.cpu,
      onboot: params.onboot,
      agent: params.agent,
      config: params.config,
    },
    timeoutMs: 30_000,
  });
  const upid = extractUpid(result?.upid ?? result);
  return { upid: upid || null };
}

// ============================================================
// SSH operations (via agent command bus → /api/v1/vm-ops)
// ============================================================

export async function testSSHConnection(): Promise<boolean> {
  const status = await getSshConnectionStatus();
  return status.connected;
}

export async function getSshConnectionStatus(options: { forceRefresh?: boolean } = {}): Promise<SshConnectionStatus> {
  const forceRefresh = options.forceRefresh === true;
  if (!forceRefresh && cachedSshStatus && cachedSshStatus.expiresAtMs > Date.now()) {
    return cachedSshStatus.value;
  }

  try {
    const result = await executeVmOps<Partial<SshConnectionStatus>>({
      type: 'proxmox',
      action: 'ssh-status',
      timeoutMs: 15_000,
    });

    const normalized: SshConnectionStatus = {
      connected: Boolean(result?.connected),
      configured: Boolean(result?.configured),
      code: typeof result?.code === 'string' ? result.code : undefined,
      message: typeof result?.message === 'string' ? result.message : undefined,
      mode: typeof result?.mode === 'string' ? result.mode : undefined,
      host: typeof result?.host === 'string' ? result.host : undefined,
      port: typeof result?.port === 'number' ? result.port : undefined,
      username: typeof result?.username === 'string' ? result.username : undefined,
    };

    cachedSshStatus = {
      expiresAtMs: Date.now() + SSH_STATUS_CACHE_TTL_MS,
      value: normalized,
    };
    return normalized;
  } catch {
    const fallback: SshConnectionStatus = {
      connected: false,
      configured: false,
      code: 'SSH_CHECK_FAILED',
    };
    cachedSshStatus = {
      expiresAtMs: Date.now() + 1_000,
      value: fallback,
    };
    return fallback;
  }
}

async function ensureSshReadyForOperation(operation: string): Promise<void> {
  const status = await getSshConnectionStatus({ forceRefresh: true });
  if (!status.configured) {
    throw new ApiClientError(
      'SSH is not configured for the selected computer. Configure SSH to use this feature.',
      {
        status: 400,
        code: 'SSH_REQUIRED',
        details: { operation, status },
      },
    );
  }

  if (!status.connected) {
    throw new ApiClientError(
      status.message || 'SSH is currently unavailable for the selected computer.',
      {
        status: 409,
        code: status.code || 'SSH_UNREACHABLE',
        details: { operation, status },
      },
    );
  }
}

export async function readVMConfig(vmid: number): Promise<string> {
  await ensureSshReadyForOperation('read-vm-config');
  const result = await executeVmOps<{ config?: string }>({
    type: 'proxmox',
    action: 'ssh-read-config',
    params: { vmid },
    timeoutMs: 15_000,
  });
  return String(result?.config || '');
}

export async function writeVMConfig(vmid: number, content: string): Promise<void> {
  await ensureSshReadyForOperation('write-vm-config');
  await executeVmOps({
    type: 'proxmox',
    action: 'ssh-write-config',
    params: { vmid, content },
    timeoutMs: 15_000,
  });
}

export async function executeSSH(command: string, timeout?: number): Promise<SSHResult> {
  await ensureSshReadyForOperation('ssh-exec');
  const result = await executeVmOps<SSHResult>({
    type: 'proxmox',
    action: 'ssh-exec',
    params: { command, timeout },
    timeoutMs: Math.max(30_000, (timeout || 0) + 10_000),
  });
  return {
    stdout: String(result?.stdout || ''),
    stderr: String(result?.stderr || ''),
    exitCode: Number(result?.exitCode ?? 1),
  };
}

// ============================================================
// VM resource registry (independent from bot records)
// ============================================================

export interface VmResourceRegistrationPayload {
  vmUuid: string;
  vmName: string;
  projectId?: string;
  metadata?: Record<string, unknown>;
}

export async function registerVmResource(
  payload: VmResourceRegistrationPayload
): Promise<{ vm_uuid: string; user_id: string; status: string }> {
  const vmUuid = String(payload.vmUuid || '').trim().toLowerCase();
  if (!vmUuid) {
    throw new Error('vmUuid is required for VM resource registration');
  }

  const vmName = String(payload.vmName || '').trim();
  const projectId = String(payload.projectId || '').trim();

  const response = await apiPost<{ vm_uuid: string; user_id: string; status: string }>('/api/v1/vm/register', {
    vm_uuid: vmUuid,
    vm_name: vmName || undefined,
    project_id: projectId || undefined,
    status: 'active',
    metadata: payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : undefined,
  });

  return response.data;
}
