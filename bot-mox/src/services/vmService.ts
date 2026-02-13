import type {
  ProxmoxVM,
  ProxmoxClusterResource,
  CloneParams,
  ProxmoxTaskStatus,
  SSHResult,
  ProxmoxVMConfig,
  VMConfigUpdateParams,
} from '../types';
import { apiGet, apiPatch, apiPost, ApiClientError } from './apiClient';
import { executeVmOps } from './vmOpsService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRunningStatus(status: unknown): boolean {
  return String(status || '').toLowerCase() === 'running';
}

// ============================================================
// Proxmox operations (via agent command bus → /api/v1/vm-ops)
// ============================================================

export async function testProxmoxConnection(): Promise<boolean> {
  try {
    const result = await executeVmOps<{ connected?: boolean }>({
      type: 'proxmox',
      action: 'status',
      timeoutMs: 15_000,
    });
    return Boolean(result?.connected);
  } catch {
    return false;
  }
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

export async function getClusterResources(): Promise<ProxmoxClusterResource[]> {
  const result = await executeVmOps<ProxmoxClusterResource[]>({
    type: 'proxmox',
    action: 'cluster-resources',
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
  const upid = String(result?.upid || '').trim();
  if (!upid) throw new Error('Clone completed without UPID');
  return { upid };
}

export async function pollTaskStatus(upid: string, node = 'h1'): Promise<ProxmoxTaskStatus> {
  const result = await executeVmOps<ProxmoxTaskStatus>({
    type: 'proxmox',
    action: 'task-status',
    params: { upid, node },
    timeoutMs: 15_000,
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
  return String(result?.upid || '').trim() || null;
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
  return { upid: String(result?.upid || '').trim() || null };
}

export async function getVMStatus(vmid: number, node = 'h1'): Promise<ProxmoxVM> {
  return executeVmOps<ProxmoxVM>({
    type: 'proxmox',
    action: 'vm-status',
    params: { vmid, node },
    timeoutMs: 15_000,
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
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await getVMStatus(vmid, node);
    if (isRunningStatus(status.status)) return;
    await sleep(pollIntervalMs);
  }
  throw new Error(`VM ${vmid} did not reach running state within ${Math.ceil(timeoutMs / 1000)}s`);
}

async function waitForTaskCompletion(
  upid: string,
  node: string,
  timeoutMs: number,
  pollIntervalMs: number,
  taskLabel: string
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await pollTaskStatus(upid, node);
    if (String(status?.status || '').toLowerCase() === 'stopped') {
      const exitStatus = String(status?.exitstatus || '').trim();
      if (exitStatus && exitStatus.toUpperCase() !== 'OK') {
        throw new Error(`${taskLabel} failed: ${exitStatus}`);
      }
      return;
    }
    await sleep(pollIntervalMs);
  }
  throw new Error(`${taskLabel} timed out after ${Math.ceil(timeoutMs / 1000)}s`);
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

export async function updateVMConfig(params: VMConfigUpdateParams): Promise<{ upid: string }> {
  const result = await executeVmOps<{ upid: string }>({
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
  const upid = String(result?.upid || '').trim();
  if (!upid) throw new Error('VM config update completed without UPID');
  return { upid };
}

// ============================================================
// SSH operations (via agent command bus → /api/v1/vm-ops)
// ============================================================

export async function testSSHConnection(): Promise<boolean> {
  try {
    await executeVmOps({ type: 'proxmox', action: 'ssh-test', timeoutMs: 15_000 });
    return true;
  } catch {
    return false;
  }
}

export async function readVMConfig(vmid: number): Promise<string> {
  const result = await executeVmOps<{ config?: string }>({
    type: 'proxmox',
    action: 'ssh-read-config',
    params: { vmid },
    timeoutMs: 15_000,
  });
  return String(result?.config || '');
}

export async function writeVMConfig(vmid: number, content: string): Promise<void> {
  await executeVmOps({
    type: 'proxmox',
    action: 'ssh-write-config',
    params: { vmid, content },
    timeoutMs: 15_000,
  });
}

export async function executeSSH(command: string, timeout?: number): Promise<SSHResult> {
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
// API upsert (replacement for FirebaseService.UpsertBotVmAsync)
// ============================================================

export async function upsertBotVM(
  uuid: string,
  vmName: string,
  ip: string,
  projectId: string = 'wow_tbc'
): Promise<{ mode: 'created' | 'updated' | 'skipped' }> {
  if (!uuid) return { mode: 'skipped' };
  if (!projectId) projectId = 'wow_tbc';

  const normalizedVmName = String(vmName || '').trim();
  const normalizedIp = String(ip || '').trim();
  let exists = false;

  try {
    await apiGet(`/api/v1/bots/${encodeURIComponent(uuid)}`);
    exists = true;
  } catch (error) {
    if (!(error instanceof ApiClientError) || error.status !== 404) {
      throw error;
    }
  }

  if (!exists) {
    await apiPost('/api/v1/bots', {
      id: uuid,
      project_id: projectId,
      status: 'prepare',
      character: {
        class: '',
        faction: '',
        level: 1,
        name: '',
        race: '',
        server: '',
        updated_at: 0,
      },
      vm: {
        name: normalizedVmName,
        ip: normalizedIp,
        created_at: new Date().toISOString(),
      },
    });
    return { mode: 'created' };
  }

  await apiPatch(`/api/v1/bots/${encodeURIComponent(uuid)}`, {
    id: uuid,
    project_id: projectId,
    'vm/name': normalizedVmName,
    'vm/ip': normalizedIp,
  });
  return { mode: 'updated' };
}
