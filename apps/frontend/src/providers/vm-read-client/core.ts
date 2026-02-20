import { executeVmOps } from '../../services/vmOpsService';
import type {
  ProxmoxClusterResource,
  ProxmoxTaskStatus,
  ProxmoxVM,
  ProxmoxVMConfig,
  VMConfigUpdateParams,
} from '../../types';
import type { ProxmoxTargetInfo } from './types';

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isRunningStatus(status: unknown): boolean {
  return String(status || '').toLowerCase() === 'running';
}

export function extractUpid(value: unknown, depth = 0): string {
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

export async function sendVMKey(vmid: number, key: string, node = 'h1'): Promise<void> {
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
