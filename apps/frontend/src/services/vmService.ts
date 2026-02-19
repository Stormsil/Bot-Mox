import type {
  CloneParams,
  ProxmoxClusterResource,
  ProxmoxTaskStatus,
  ProxmoxVM,
  ProxmoxVMConfig,
  VMConfigUpdateParams,
} from '../types';
import { ApiClientError, apiPost } from './apiClient';
import { executeVmOps } from './vmOpsService';
import {
  executeSSH,
  getSshConnectionStatus,
  readVMConfig,
  testSSHConnection,
  writeVMConfig,
} from './vmService/sshOps';
import {
  type StartAndSendKeyBatchResult,
  type StartAndSendKeyOptions,
  startAndSendKeyBatchWithDeps,
} from './vmService/startAndSendKey';

export type { SshConnectionStatus } from './vmService/sshOps';
export type {
  StartAndSendKeyBatchResult,
  StartAndSendKeyOptions,
  StartAndSendKeyResultItem,
} from './vmService/startAndSendKey';
export { executeSSH, getSshConnectionStatus, readVMConfig, testSSHConnection, writeVMConfig };

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
    if (
      error instanceof ApiClientError &&
      AGENT_CONNECTIVITY_ERROR_CODES.has(String(error.code || '').trim())
    ) {
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
  resourceType: string = 'storage',
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
  options: { timeoutMs?: number; intervalMs?: number } = {},
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
  options: DeleteVMOptions = {},
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

export async function waitForVmPresence(
  vmid: number,
  node = 'h1',
  exists = true,
  options: { timeoutMs?: number; intervalMs?: number } = {},
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

export async function startAndSendKeyBatch(
  vmIds: number[],
  options: StartAndSendKeyOptions = {},
): Promise<StartAndSendKeyBatchResult> {
  return startAndSendKeyBatchWithDeps(vmIds, options, {
    sleep,
    isRunningStatus,
    getVMStatus,
    waitForVmStatus,
    waitForTask,
    startVM,
    sendVMKey,
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
  payload: VmResourceRegistrationPayload,
): Promise<{ vm_uuid: string; user_id: string; status: string }> {
  const vmUuid = String(payload.vmUuid || '')
    .trim()
    .toLowerCase();
  if (!vmUuid) {
    throw new Error('vmUuid is required for VM resource registration');
  }

  const vmName = String(payload.vmName || '').trim();
  const projectId = String(payload.projectId || '').trim();

  const response = await apiPost<{ vm_uuid: string; user_id: string; status: string }>(
    '/api/v1/vm/register',
    {
      vm_uuid: vmUuid,
      vm_name: vmName || undefined,
      project_id: projectId || undefined,
      status: 'active',
      metadata:
        payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : undefined,
    },
  );

  return response.data;
}
