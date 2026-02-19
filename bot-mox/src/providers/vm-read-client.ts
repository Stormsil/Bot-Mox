import { executeVmOps } from '../services/vmOpsService';
import type {
  ProxmoxClusterResource,
  ProxmoxTaskStatus,
  ProxmoxVM,
  ProxmoxVMConfig,
  VMConfigUpdateParams,
} from '../types';

export interface ProxmoxTargetInfo {
  id: string;
  label: string;
  url: string;
  username: string;
  node: string;
  isActive?: boolean;
  sshConfigured?: boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
      if (extracted) {
        return extracted;
      }
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
      if (extracted) {
        return extracted;
      }
    }
    return '';
  }

  return '';
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
  resourceType = 'storage',
): Promise<ProxmoxClusterResource[]> {
  const result = await executeVmOps<ProxmoxClusterResource[]>({
    type: 'proxmox',
    action: 'cluster-resources',
    params: { type: resourceType },
  });
  return Array.isArray(result) ? result : [];
}

export async function waitForTask(
  upid: unknown,
  node = 'h1',
  options: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<ProxmoxTaskStatus> {
  const normalizedUpid = extractUpid(upid);
  if (!normalizedUpid) {
    throw new Error('Task wait requested without a valid UPID');
  }

  const timeoutMs = Math.max(1_000, Math.trunc(options.timeoutMs ?? 300_000));
  const intervalMs = Math.max(250, Math.trunc(options.intervalMs ?? 1_000));
  return executeVmOps<ProxmoxTaskStatus>({
    type: 'proxmox',
    action: 'wait-task',
    params: { upid: normalizedUpid, node, timeoutMs, intervalMs },
    timeoutMs: timeoutMs + 30_000,
  });
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

async function getVMStatus(vmid: number, node = 'h1'): Promise<ProxmoxVM> {
  return executeVmOps<ProxmoxVM>({
    type: 'proxmox',
    action: 'vm-status',
    params: { vmid, node },
    timeoutMs: 15_000,
  });
}

async function waitForVmStatus(
  vmid: number,
  node = 'h1',
  desiredStatus = 'running',
  options: { timeoutMs?: number; intervalMs?: number } = {},
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

async function sendVMKey(vmid: number, key: string, node = 'h1'): Promise<void> {
  const normalizedKey = String(key || '').trim();
  if (!normalizedKey) {
    throw new Error('key is required');
  }
  await executeVmOps({
    type: 'proxmox',
    action: 'sendkey',
    params: { vmid, key: normalizedKey, node },
    timeoutMs: 15_000,
  });
}

interface StartAndSendKeyOptions {
  node?: string;
  key?: string;
  repeatCount?: number;
  intervalMs?: number;
  startupDelayMs?: number;
  waitTimeoutMs?: number;
  pollIntervalMs?: number;
}

interface StartAndSendKeyResultItem {
  vmid: number;
  success: boolean;
  error?: string;
}

interface StartAndSendKeyBatchResult {
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
  pollIntervalMs: number,
): Promise<void> {
  const status = await waitForVmStatus(vmid, node, 'running', {
    timeoutMs,
    intervalMs: pollIntervalMs,
  });
  if (!isRunningStatus(status.status)) {
    throw new Error(
      `VM ${vmid} did not reach running state within ${Math.ceil(timeoutMs / 1000)}s`,
    );
  }
}

async function waitForTaskCompletion(
  upid: string,
  node: string,
  timeoutMs: number,
  pollIntervalMs: number,
  taskLabel: string,
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
  options: Required<
    Pick<StartAndSendKeyOptions, 'node' | 'key' | 'repeatCount' | 'intervalMs' | 'startupDelayMs'>
  >,
  signal: { cancelled: boolean },
): Promise<SendKeySpamResult> {
  if (options.startupDelayMs > 0) {
    await sleep(options.startupDelayMs);
  }

  let sent = 0;
  let lastError: string | null = null;

  for (let index = 0; index < options.repeatCount; index += 1) {
    if (signal.cancelled) {
      break;
    }
    try {
      await sendVMKey(vmid, options.key, options.node);
      sent += 1;
      lastError = null;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    if (index < options.repeatCount - 1 && options.intervalMs > 0) {
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
  options: Required<
    Pick<
      StartAndSendKeyOptions,
      | 'node'
      | 'key'
      | 'repeatCount'
      | 'intervalMs'
      | 'startupDelayMs'
      | 'waitTimeoutMs'
      | 'pollIntervalMs'
    >
  >,
): Promise<void> {
  let isAlreadyRunning = false;
  try {
    const current = await getVMStatus(vmid, options.node);
    isAlreadyRunning = isRunningStatus(current.status);
  } catch {
    // Ignore status failures and continue with start flow.
  }

  const spamSignal = { cancelled: false };
  const sendKeySpamPromise = runSendKeySpam(vmid, options, spamSignal);

  try {
    if (!isAlreadyRunning) {
      let startUpid: string | null = null;
      try {
        startUpid = await startVM(vmid, options.node);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/already running|status: running|state is running|vm is running/i.test(message)) {
          isAlreadyRunning = true;
        } else {
          throw error;
        }
      }

      if (!isAlreadyRunning && startUpid) {
        await waitForTaskCompletion(
          startUpid,
          options.node,
          Math.max(options.waitTimeoutMs, 180_000),
          options.pollIntervalMs,
          `VM ${vmid} start task`,
        );
      }
    }

    await waitUntilVmRunning(vmid, options.node, options.waitTimeoutMs, options.pollIntervalMs);

    const spamResult = await sendKeySpamPromise;
    if (spamResult.sent === 0) {
      const suffix = spamResult.lastError ? ` Last error: ${spamResult.lastError}` : '';
      throw new Error(
        `VM ${vmid} did not accept key "${options.key}" during ${spamResult.attempts} attempts.${suffix}`,
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
  options: StartAndSendKeyOptions = {},
): Promise<StartAndSendKeyBatchResult> {
  const normalizedVmIds = Array.from(
    new Set((vmIds || []).map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)),
  );

  if (normalizedVmIds.length === 0) {
    throw new Error('No VM IDs provided');
  }

  const effectiveOptions = {
    node: options.node || 'h1',
    key: (options.key || 'a').trim() || 'a',
    repeatCount: Math.max(1, Math.trunc(options.repeatCount ?? 10)),
    intervalMs: Math.max(0, Math.trunc(options.intervalMs ?? 1_000)),
    startupDelayMs: Math.max(0, Math.trunc(options.startupDelayMs ?? 3_000)),
    waitTimeoutMs: Math.max(1_000, Math.trunc(options.waitTimeoutMs ?? 120_000)),
    pollIntervalMs: Math.max(250, Math.trunc(options.pollIntervalMs ?? 1_000)),
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
    }),
  );

  const ok = results.filter((item) => item.success).length;
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

export async function updateVMConfig(
  params: VMConfigUpdateParams,
): Promise<{ upid: string | null }> {
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
