import {
  PROXMOX_ACTION_UNHANDLED,
  type ProxmoxActionContext,
  type ProxmoxActionResult,
} from './context';
import { login, proxmoxRequest } from './session';
import { extractUpid } from './utils';

const VM_LIFECYCLE_ACTIONS = new Set(['start', 'stop', 'shutdown', 'reset', 'suspend', 'resume']);

export async function handleVmActions(context: ProxmoxActionContext): Promise<ProxmoxActionResult> {
  const { action, payload, config, logger, node, vmid } = context;

  if (VM_LIFECYCLE_ACTIONS.has(action)) {
    if (!vmid) throw new Error(`vmid required for proxmox.${action}`);
    const taskResult = await proxmoxRequest(
      config,
      logger,
      'POST',
      `/api2/json/nodes/${node}/qemu/${vmid}/status/${action}`,
    );
    return { upid: extractUpid(taskResult) };
  }

  if (action === 'clone') {
    const templateVmId = payload.templateVmId ? String(payload.templateVmId) : vmid;
    if (!templateVmId) throw new Error('vmid or templateVmId required for proxmox.clone');
    const cloneData: Record<string, unknown> = {};
    if (payload.newid) cloneData.newid = payload.newid;
    if (payload.name) cloneData.name = payload.name;
    if (payload.storage) cloneData.storage = payload.storage;
    if (payload.format) cloneData.format = payload.format;
    if (payload.full !== undefined) cloneData.full = payload.full ? 1 : 0;
    const taskResult = await proxmoxRequest(
      config,
      logger,
      'POST',
      `/api2/json/nodes/${node}/qemu/${templateVmId}/clone`,
      cloneData,
    );
    return { upid: extractUpid(taskResult) };
  }

  if (action === 'delete') {
    if (!vmid) throw new Error('vmid required for proxmox.delete');
    const params: string[] = [];
    if (payload.purge) params.push('purge=1');
    if (payload.destroyUnreferencedDisks) params.push('destroy-unreferenced-disks=1');
    const qs = params.length ? `?${params.join('&')}` : '';
    const taskResult = await proxmoxRequest(
      config,
      logger,
      'DELETE',
      `/api2/json/nodes/${node}/qemu/${vmid}${qs}`,
    );
    return { upid: extractUpid(taskResult) };
  }

  if (action === 'list' || action === 'list-vms') {
    return proxmoxRequest(config, logger, 'GET', `/api2/json/nodes/${node}/qemu`);
  }

  if (action === 'vm-status') {
    if (!vmid) throw new Error('vmid required for proxmox.vm-status');
    return proxmoxRequest(
      config,
      logger,
      'GET',
      `/api2/json/nodes/${node}/qemu/${vmid}/status/current`,
    );
  }

  if (action === 'config.get' || action === 'get-config') {
    if (!vmid) throw new Error('vmid required for proxmox.get-config');
    return proxmoxRequest(config, logger, 'GET', `/api2/json/nodes/${node}/qemu/${vmid}/config`);
  }

  if (action === 'config.update' || action === 'update-config') {
    if (!vmid) throw new Error('vmid required for proxmox.update-config');
    const cfgData: Record<string, unknown> = {};
    const nested = (payload.config as Record<string, unknown>) ?? {};
    for (const [k, v] of Object.entries({ ...nested, ...payload })) {
      if (['vmid', 'node', 'config', 'target', 'targetId'].includes(k)) continue;
      cfgData[k] = v;
    }
    const taskResult = await proxmoxRequest(
      config,
      logger,
      'PUT',
      `/api2/json/nodes/${node}/qemu/${vmid}/config`,
      cfgData,
    );
    return { upid: extractUpid(taskResult) };
  }

  if (action === 'resize-disk') {
    if (!vmid) throw new Error('vmid required for proxmox.resize-disk');
    const disk = String(payload.disk || '').trim();
    const size = String(payload.size || '').trim();
    if (!disk) throw new Error('disk required for proxmox.resize-disk');
    if (!size) throw new Error('size required for proxmox.resize-disk');

    const taskResult = await proxmoxRequest(
      config,
      logger,
      'PUT',
      `/api2/json/nodes/${node}/qemu/${vmid}/resize`,
      { disk, size },
    );
    return { upid: extractUpid(taskResult) };
  }

  if (action === 'sendkey') {
    if (!vmid) throw new Error('vmid required for proxmox.sendkey');
    const key = payload.key ? String(payload.key) : undefined;
    if (!key) throw new Error('key required for proxmox.sendkey');
    return proxmoxRequest(config, logger, 'PUT', `/api2/json/nodes/${node}/qemu/${vmid}/sendkey`, {
      key,
    });
  }

  if (action === 'cluster-resources') {
    const resourceType = String(payload.type ?? payload.resourceType ?? '').trim();
    const suffix = resourceType ? `?type=${encodeURIComponent(resourceType)}` : '';
    return proxmoxRequest(config, logger, 'GET', `/api2/json/cluster/resources${suffix}`);
  }

  if (action === 'status') {
    const version = await proxmoxRequest(config, logger, 'GET', '/api2/json/version');
    return { connected: true, ...(version as object) };
  }

  if (action === 'login') {
    await login(config, logger, { forceFresh: Boolean(payload.force) });
    return { ok: true };
  }

  return PROXMOX_ACTION_UNHANDLED;
}
