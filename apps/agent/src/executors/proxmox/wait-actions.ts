import {
  PROXMOX_ACTION_UNHANDLED,
  type ProxmoxActionContext,
  type ProxmoxActionResult,
} from './context';
import { proxmoxRequest } from './session';
import { extractUpid, normalizeTimeoutMs, sleep } from './utils';

export async function handleWaitActions(
  context: ProxmoxActionContext,
): Promise<ProxmoxActionResult> {
  const { action, payload, config, logger, node, vmid } = context;

  if (action === 'task-status') {
    const upid = extractUpid(payload.upid ?? payload.task ?? payload.taskId);
    if (!upid) throw new Error('upid required for proxmox.task-status');
    return proxmoxRequest(
      config,
      logger,
      'GET',
      `/api2/json/nodes/${node}/tasks/${encodeURIComponent(upid)}/status`,
    );
  }

  if (action === 'wait-task') {
    const upid = extractUpid(payload.upid ?? payload.task ?? payload.taskId);
    if (!upid) throw new Error('upid required for proxmox.wait-task');
    const timeoutMs = normalizeTimeoutMs(payload.timeoutMs ?? payload.timeout_ms, 300_000, {
      min: 1_000,
      max: 1_800_000,
    });
    const intervalMs = normalizeTimeoutMs(payload.intervalMs ?? payload.interval_ms, 1_000, {
      min: 250,
      max: 15_000,
    });
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const status = (await proxmoxRequest(
        config,
        logger,
        'GET',
        `/api2/json/nodes/${node}/tasks/${encodeURIComponent(upid)}/status`,
      )) as Record<string, unknown>;
      if (
        String(status.status || '')
          .trim()
          .toLowerCase() === 'stopped'
      ) {
        return status;
      }
      await sleep(intervalMs);
    }

    throw new Error(`Proxmox task ${upid} timed out after ${Math.ceil(timeoutMs / 1000)}s`);
  }

  if (action === 'wait-vm-status') {
    if (!vmid) throw new Error('vmid required for proxmox.wait-vm-status');
    const desiredStatus = String(payload.desiredStatus || payload.status || 'running')
      .trim()
      .toLowerCase();
    if (!desiredStatus) throw new Error('desiredStatus is required for proxmox.wait-vm-status');
    const timeoutMs = normalizeTimeoutMs(payload.timeoutMs ?? payload.timeout_ms, 120_000, {
      min: 1_000,
      max: 1_800_000,
    });
    const intervalMs = normalizeTimeoutMs(payload.intervalMs ?? payload.interval_ms, 1_000, {
      min: 250,
      max: 15_000,
    });
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const status = (await proxmoxRequest(
        config,
        logger,
        'GET',
        `/api2/json/nodes/${node}/qemu/${vmid}/status/current`,
      )) as Record<string, unknown>;
      if (
        String(status.status || '')
          .trim()
          .toLowerCase() === desiredStatus
      ) {
        return status;
      }
      await sleep(intervalMs);
    }

    throw new Error(
      `VM ${vmid} did not reach status "${desiredStatus}" within ${Math.ceil(timeoutMs / 1000)}s`,
    );
  }

  if (action === 'wait-vm-presence') {
    if (!vmid) throw new Error('vmid required for proxmox.wait-vm-presence');
    const shouldExist = payload.exists !== undefined ? Boolean(payload.exists) : true;
    const timeoutMs = normalizeTimeoutMs(payload.timeoutMs ?? payload.timeout_ms, 45_000, {
      min: 1_000,
      max: 600_000,
    });
    const intervalMs = normalizeTimeoutMs(payload.intervalMs ?? payload.interval_ms, 1_000, {
      min: 250,
      max: 15_000,
    });
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const vmList = (await proxmoxRequest(
        config,
        logger,
        'GET',
        `/api2/json/nodes/${node}/qemu`,
      )) as Array<Record<string, unknown>>;
      const exists =
        Array.isArray(vmList) &&
        vmList.some((vm) => String(vm?.vmid || '').trim() === String(vmid));
      if (exists === shouldExist) {
        return { vmid: Number(vmid), exists };
      }
      await sleep(intervalMs);
    }

    const expected = shouldExist ? 'present' : 'absent';
    throw new Error(`VM ${vmid} did not become ${expected} within ${Math.ceil(timeoutMs / 1000)}s`);
  }

  return PROXMOX_ACTION_UNHANDLED;
}
