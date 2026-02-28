import { useCallback } from 'react';
import type { VMGeneratorSettings, VMQueueItem } from '../../../shared/types';
import { syncTemplateHardwareFromApi as syncTemplateHardwareFromApiAction } from '../page/templateHardwareSync';

interface UseVmTemplateHardwareSyncParams {
  settingsRef: React.RefObject<VMGeneratorSettings | null>;
  proxmoxNode: string;
  templateHardwareLiveRef: React.RefObject<{ cores: number; memory: number } | null>;
  queueItemsRef: React.RefObject<VMQueueItem[]>;
  setTemplateHardwareLive: React.Dispatch<
    React.SetStateAction<{ cores: number; memory: number } | null>
  >;
  updateQueueItem: (id: string, updates: Partial<VMQueueItem>) => void;
}

export function useVmTemplateHardwareSync({
  settingsRef,
  proxmoxNode,
  templateHardwareLiveRef,
  queueItemsRef,
  setTemplateHardwareLive,
  updateQueueItem,
}: UseVmTemplateHardwareSyncParams) {
  return useCallback(
    async (
      explicitSettings?: VMGeneratorSettings | null,
      options?: { isCurrent?: () => boolean },
    ): Promise<{ cores: number; memory: number } | null> => {
      return syncTemplateHardwareFromApiAction({
        explicitSettings,
        isCurrent: options?.isCurrent,
        settingsRef,
        proxmoxNode,
        templateHardwareLiveRef,
        queueItemsRef,
        setTemplateHardwareLive,
        updateQueueItem,
      });
    },
    [
      proxmoxNode,
      queueItemsRef,
      settingsRef,
      setTemplateHardwareLive,
      templateHardwareLiveRef,
      updateQueueItem,
    ],
  );
}
