import { message } from 'antd';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { getVMConfig } from '../../../entities/vm/api/vmReadFacade';
import type { VMGeneratorSettings, VMQueueItem } from '../../../types';
import { normalizeCores, normalizeMemory } from '../vmPageUtils';

interface SyncTemplateHardwareParams {
  explicitSettings?: VMGeneratorSettings | null;
  settingsRef: MutableRefObject<VMGeneratorSettings | null>;
  proxmoxNode: string;
  templateHardwareLiveRef: MutableRefObject<{ cores: number; memory: number } | null>;
  queueItemsRef: MutableRefObject<VMQueueItem[]>;
  setTemplateHardwareLive: Dispatch<SetStateAction<{ cores: number; memory: number } | null>>;
  updateQueueItem: (id: string, updates: Partial<VMQueueItem>) => void;
}

export async function syncTemplateHardwareFromApi(params: SyncTemplateHardwareParams): Promise<{
  cores: number;
  memory: number;
} | null> {
  const activeSettings = params.explicitSettings || params.settingsRef.current;
  if (!activeSettings) {
    return null;
  }

  const fallbackCores = normalizeCores(activeSettings.hardware?.cores, 2);
  const fallbackMemory = normalizeMemory(activeSettings.hardware?.memory, 4096);
  const vmId = Number(activeSettings.template?.vmId || 100);
  const node = activeSettings.proxmox?.node || params.proxmoxNode || 'h1';
  const previousTemplate = params.templateHardwareLiveRef.current || {
    cores: fallbackCores,
    memory: fallbackMemory,
  };

  if (!Number.isFinite(vmId) || vmId < 1) {
    const fallback = { cores: fallbackCores, memory: fallbackMemory };
    params.setTemplateHardwareLive(fallback);
    return fallback;
  }

  try {
    const config = await getVMConfig(vmId, node);
    const cores = normalizeCores(config.cores, fallbackCores);
    const memory = normalizeMemory(config.memory, fallbackMemory);
    params.setTemplateHardwareLive({ cores, memory });

    params.queueItemsRef.current.forEach((item) => {
      if (item.status !== 'pending') return;
      if ((item.resourceMode || 'original') !== 'original') return;

      const itemCores = normalizeCores(item.cores, previousTemplate.cores);
      const itemMemory = normalizeMemory(item.memory, previousTemplate.memory);
      const looksStale =
        item.cores === undefined ||
        item.memory === undefined ||
        (itemCores === previousTemplate.cores && itemMemory === previousTemplate.memory);

      if (looksStale) {
        params.updateQueueItem(item.id, { cores, memory });
      }
    });

    return { cores, memory };
  } catch {
    const fallback = { cores: fallbackCores, memory: fallbackMemory };
    params.setTemplateHardwareLive(fallback);
    return fallback;
  }
}

export function showTargetLoadError(error: Error | null): void {
  if (!error) {
    return;
  }
  message.warning(error.message || 'Failed to load computers');
}
