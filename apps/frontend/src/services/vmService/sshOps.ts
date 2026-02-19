import type { SSHResult } from '../../types';
import { ApiClientError } from '../apiClient';
import { executeVmOps } from '../vmOpsService';

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

export async function testSSHConnection(): Promise<boolean> {
  const status = await getSshConnectionStatus();
  return status.connected;
}

export async function getSshConnectionStatus(
  options: { forceRefresh?: boolean } = {},
): Promise<SshConnectionStatus> {
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
