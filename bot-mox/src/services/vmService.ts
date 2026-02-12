import type {
  ProxmoxVM,
  ProxmoxClusterResource,
  CloneParams,
  ProxmoxTaskStatus,
  SSHResult,
  ProxmoxVMConfig,
  VMConfigUpdateParams,
} from '../types';
import { API_BASE_URL as API_BASE_URL_FROM_ENV } from '../config/env';
import { authFetch } from './authFetch';
import { apiGet, apiPatch, apiPost, ApiClientError } from './apiClient';

const LOCAL_PROXY_URL = API_BASE_URL_FROM_ENV;
const INFRA_API_PREFIX = '/api/v1/infra';

function extractApiErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') {
    return fallback;
  }

  const error = (payload as Record<string, unknown>).error;
  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  if (error && typeof error === 'object') {
    const message = (error as Record<string, unknown>).message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  return fallback;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRunningStatus(status: unknown): boolean {
  return String(status || '').toLowerCase() === 'running';
}

// ============================================================
// Proxmox operations (via proxy-server)
// ============================================================

export async function testProxmoxConnection(): Promise<boolean> {
  try {
    const res = await authFetch(`${LOCAL_PROXY_URL}${INFRA_API_PREFIX}/proxmox/status`);
    const data = await res.json();
    if (!data?.success) {
      return false;
    }
    return Boolean(data.connected || data?.data?.connected);
  } catch {
    return false;
  }
}

export async function proxmoxLogin(): Promise<boolean> {
  try {
    const res = await authFetch(`${LOCAL_PROXY_URL}${INFRA_API_PREFIX}/proxmox/login`, { method: 'POST' });
    const data = await res.json();
    return Boolean(data?.success);
  } catch {
    return false;
  }
}

export async function listVMs(node = 'h1'): Promise<ProxmoxVM[]> {
  const res = await authFetch(`${LOCAL_PROXY_URL}${INFRA_API_PREFIX}/proxmox/nodes/${node}/qemu`);
  const data = await res.json();
  if (!data.success) throw new Error(extractApiErrorMessage(data, 'Failed to list VMs'));
  const payload = Array.isArray(data.data) ? data.data : [];
  return payload as ProxmoxVM[];
}

export async function getClusterResources(): Promise<ProxmoxClusterResource[]> {
  const res = await authFetch(`${LOCAL_PROXY_URL}${INFRA_API_PREFIX}/proxmox/cluster/resources`);
  const data = await res.json();
  if (!data.success) throw new Error(extractApiErrorMessage(data, 'Failed to load cluster resources'));
  return Array.isArray(data.data) ? (data.data as ProxmoxClusterResource[]) : [];
}

export async function cloneVM(params: CloneParams): Promise<{ upid: string }> {
  const node = params.node || 'h1';
  const res = await authFetch(
    `${LOCAL_PROXY_URL}${INFRA_API_PREFIX}/proxmox/nodes/${node}/qemu/${params.templateVmId}/clone`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        newid: params.newid,
        name: params.name,
        storage: params.storage,
        format: params.format,
        full: params.full ? 1 : 0,
      }),
    }
  );
  const data = await res.json();
  if (!data.success) {
    const errorDetails =
      (data && typeof data === 'object' && data.error && typeof data.error === 'object')
        ? (data.error as { details?: unknown }).details
        : undefined;
    const details =
      errorDetails && typeof errorDetails === 'object'
        ? JSON.stringify(errorDetails)
        : (errorDetails ? String(errorDetails) : '');
    const message = extractApiErrorMessage(data, 'Clone failed');
    throw new Error(details ? `${message}: ${details}` : message);
  }
  const upid = String(data?.upid || data?.data?.upid || '').trim();
  if (!upid) {
    throw new Error('Clone completed without UPID');
  }
  return { upid };
}

export async function pollTaskStatus(upid: string, node = 'h1'): Promise<ProxmoxTaskStatus> {
  const res = await authFetch(
    `${LOCAL_PROXY_URL}${INFRA_API_PREFIX}/proxmox/nodes/${node}/tasks/${encodeURIComponent(upid)}/status`
  );
  const data = await res.json();
  if (!data.success) throw new Error(extractApiErrorMessage(data, 'Failed to poll task'));
  return data.data as ProxmoxTaskStatus;
}

export async function startVM(vmid: number, node = 'h1'): Promise<string | null> {
  const res = await authFetch(
    `${LOCAL_PROXY_URL}${INFRA_API_PREFIX}/proxmox/nodes/${node}/qemu/${vmid}/status/start`,
    { method: 'POST' }
  );
  const data = await res.json();
  if (!data.success) throw new Error(extractApiErrorMessage(data, 'Failed to start VM'));
  const upid = String(data?.upid || data?.data?.upid || data?.data || '').trim();
  return upid || null;
}

export async function stopVM(vmid: number, node = 'h1'): Promise<void> {
  const res = await authFetch(
    `${LOCAL_PROXY_URL}${INFRA_API_PREFIX}/proxmox/nodes/${node}/qemu/${vmid}/status/stop`,
    { method: 'POST' }
  );
  const data = await res.json();
  if (!data.success) throw new Error(extractApiErrorMessage(data, 'Failed to stop VM'));
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
  const purge = options.purge ?? true;
  const destroyUnreferencedDisks = options.destroyUnreferencedDisks ?? true;
  const params = new URLSearchParams();
  if (purge) params.set('purge', '1');
  if (destroyUnreferencedDisks) params.set('destroy-unreferenced-disks', '1');
  const query = params.toString();
  const url = `${LOCAL_PROXY_URL}${INFRA_API_PREFIX}/proxmox/nodes/${node}/qemu/${vmid}${query ? `?${query}` : ''}`;

  let res: Response;
  try {
    res = await authFetch(url, { method: 'DELETE' });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Delete request failed (network/CORS): ${msg}`);
  }

  let data: { success?: boolean; error?: string; upid?: string; data?: { upid?: string } };
  try {
    data = await res.json();
  } catch {
    throw new Error(`Delete request failed (HTTP ${res.status}): invalid response from proxy`);
  }

  if (!data.success) throw new Error(extractApiErrorMessage(data, 'Failed to delete VM'));
  const upidRaw = typeof data.upid === 'string' && data.upid.trim()
    ? data.upid.trim()
    : (typeof data.data?.upid === 'string' ? data.data.upid.trim() : '');
  const upid = upidRaw || null;
  return { upid };
}

export async function getVMStatus(vmid: number, node = 'h1'): Promise<ProxmoxVM> {
  const res = await authFetch(
    `${LOCAL_PROXY_URL}${INFRA_API_PREFIX}/proxmox/nodes/${node}/qemu/${vmid}/status/current`
  );
  const data = await res.json();
  if (!data.success) throw new Error(extractApiErrorMessage(data, 'Failed to get VM status'));
  return data.data as ProxmoxVM;
}

export async function sendVMKey(vmid: number, key: string, node = 'h1'): Promise<void> {
  const normalizedKey = String(key || '').trim();
  if (!normalizedKey) throw new Error('key is required');
  const res = await authFetch(
    `${LOCAL_PROXY_URL}${INFRA_API_PREFIX}/proxmox/nodes/${node}/qemu/${vmid}/sendkey`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: normalizedKey }),
    }
  );
  const data = await res.json();
  if (!data.success) throw new Error(extractApiErrorMessage(data, 'Failed to send VM key'));
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
      // VM may still be booting: keep retrying throughout the spam window.
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
    // Ignore status probe errors here and rely on start task + follow-up checks.
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
  const res = await authFetch(
    `${LOCAL_PROXY_URL}${INFRA_API_PREFIX}/proxmox/nodes/${node}/qemu/${vmid}/config`
  );
  const data = await res.json();
  if (!data.success) throw new Error(extractApiErrorMessage(data, 'Failed to get VM config'));
  return (data.data || {}) as ProxmoxVMConfig;
}

export async function updateVMConfig(params: VMConfigUpdateParams): Promise<{ upid: string }> {
  const node = params.node || 'h1';
  const payload: Record<string, string | number | boolean | undefined> = {
    ...(params.config || {}),
  };
  if (params.cores !== undefined) payload.cores = params.cores;
  if (params.sockets !== undefined) payload.sockets = params.sockets;
  if (params.memory !== undefined) payload.memory = params.memory;
  if (params.balloon !== undefined) payload.balloon = params.balloon;
  if (params.cpu !== undefined) payload.cpu = params.cpu;
  if (params.onboot !== undefined) payload.onboot = params.onboot;
  if (params.agent !== undefined) payload.agent = params.agent;

  const res = await authFetch(
    `${LOCAL_PROXY_URL}${INFRA_API_PREFIX}/proxmox/nodes/${node}/qemu/${params.vmid}/config`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  const data = await res.json();
  if (!data.success) {
    const errorDetails =
      (data && typeof data === 'object' && data.error && typeof data.error === 'object')
        ? (data.error as { details?: unknown }).details
        : undefined;
    const details =
      errorDetails && typeof errorDetails === 'object'
        ? JSON.stringify(errorDetails)
        : (errorDetails ? String(errorDetails) : '');
    const message = extractApiErrorMessage(data, 'Failed to update VM config');
    throw new Error(details ? `${message}: ${details}` : message);
  }
  const upid = String(data?.upid || data?.data?.upid || '').trim();
  if (!upid) {
    throw new Error('VM config update completed without UPID');
  }
  return { upid };
}

// ============================================================
// SSH operations (via proxy-server)
// ============================================================

export async function testSSHConnection(): Promise<boolean> {
  try {
    const res = await authFetch(`${LOCAL_PROXY_URL}${INFRA_API_PREFIX}/ssh/test`, { method: 'POST' });
    const data = await res.json();
    return Boolean(data?.success);
  } catch {
    return false;
  }
}

export async function readVMConfig(vmid: number): Promise<string> {
  const res = await authFetch(`${LOCAL_PROXY_URL}${INFRA_API_PREFIX}/ssh/vm-config/${vmid}`);
  const data = await res.json();
  if (!data.success) throw new Error(extractApiErrorMessage(data, 'Failed to read config'));
  return String(data?.config || data?.data?.config || '');
}

export async function writeVMConfig(vmid: number, content: string): Promise<void> {
  const res = await authFetch(`${LOCAL_PROXY_URL}${INFRA_API_PREFIX}/ssh/vm-config/${vmid}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(extractApiErrorMessage(data, 'Failed to write config'));
}

export async function executeSSH(command: string, timeout?: number): Promise<SSHResult> {
  const res = await authFetch(`${LOCAL_PROXY_URL}${INFRA_API_PREFIX}/ssh/exec`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command, timeout }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(extractApiErrorMessage(data, 'SSH exec failed'));
  return {
    stdout: String(data?.stdout || data?.data?.stdout || ''),
    stderr: String(data?.stderr || data?.data?.stderr || ''),
    exitCode: Number(data?.exitCode ?? data?.data?.exitCode ?? 1),
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

