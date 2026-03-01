import { useEffect, useRef } from 'react';
import type { ProxmoxVM, VMGeneratorSettings, VMQueueItem } from '../../../shared/types';

interface UseVmPageLiveRefsParams {
  proxmoxVms: ProxmoxVM[];
  workspaceQueueItems: VMQueueItem[];
  settings: VMGeneratorSettings | null;
  templateHardwareLive: { cores: number; memory: number } | null;
}

export function useVmPageLiveRefs({
  proxmoxVms,
  workspaceQueueItems,
  settings,
  templateHardwareLive,
}: UseVmPageLiveRefsParams) {
  const proxmoxVmsRef = useRef(proxmoxVms);
  const queueItemsRef = useRef<VMQueueItem[]>(workspaceQueueItems);
  const settingsRef = useRef<VMGeneratorSettings | null>(settings);
  const templateHardwareLiveRef = useRef<{ cores: number; memory: number } | null>(
    templateHardwareLive,
  );

  useEffect(() => {
    proxmoxVmsRef.current = proxmoxVms;
  }, [proxmoxVms]);

  useEffect(() => {
    queueItemsRef.current = workspaceQueueItems;
  }, [workspaceQueueItems]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    templateHardwareLiveRef.current = templateHardwareLive;
  }, [templateHardwareLive]);

  return {
    proxmoxVmsRef,
    queueItemsRef,
    settingsRef,
    templateHardwareLiveRef,
  };
}
