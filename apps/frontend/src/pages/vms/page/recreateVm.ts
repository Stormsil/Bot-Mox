import { message } from 'antd';
import type { VMGeneratorSettings, VMQueueItem, VMResourceMode } from '../../../types';
import type { VMProjectId } from './resourcePresets';

interface RecreateVmInput {
  vmid: number;
  name?: string;
}

interface QueueFacade {
  addDeleteToQueue: (params: {
    vmid: number;
    name: string;
    projectId: VMProjectId;
  }) => VMQueueItem | null;
  addToQueue: (params: {
    name: string;
    storage: string;
    storageMode: 'auto' | 'manual';
    format: string;
    projectId: VMProjectId;
    resourceMode: VMResourceMode;
    cores: number;
    memory: number;
    diskGiB?: number;
  }) => void;
}

export function enqueueVmRecreate(params: {
  vm: RecreateVmInput;
  queue: QueueFacade;
  settings: VMGeneratorSettings | null;
  getProjectPreset: (projectId: VMProjectId) => { cores: number; memory: number; diskGiB?: number };
}): void {
  const { vm, queue, settings, getProjectPreset } = params;
  const vmid = Number(vm.vmid);
  if (!Number.isInteger(vmid) || vmid <= 0) {
    message.error('Invalid VM ID for recreate');
    return;
  }

  const vmName = vm.name || `VM ${vmid}`;
  const normalizedName = String(vmName).toLowerCase();
  const projectId: VMProjectId = normalizedName.includes('midnight') ? 'wow_midnight' : 'wow_tbc';
  const preset = getProjectPreset(projectId);
  const storage = String(settings?.storage?.default || '').trim() || 'data';

  const addedDelete = queue.addDeleteToQueue({ vmid, name: vmName, projectId });
  queue.addToQueue({
    name: vmName,
    storage,
    storageMode: settings?.storage?.autoSelectBest ? 'auto' : 'manual',
    format: settings?.format?.default || 'raw',
    projectId,
    resourceMode: 'project',
    cores: preset.cores,
    memory: preset.memory,
    diskGiB: preset.diskGiB,
  });

  if (!addedDelete) {
    message.info(`Create task added for ${vmName}. Delete task already exists in queue.`);
    return;
  }

  message.success(`Recreate queued: delete + create for ${vmName}`);
}
