import { useEffect, useRef } from 'react';
import type { ProxmoxVM, VMGeneratorSettings, VMQueueItem } from '../../../shared/types';

interface UseVmPageLiveRefsParams {
  proxmoxVms: ProxmoxVM[];
  queueItems: VMQueueItem[];
  settings: VMGeneratorSettings | null;
  templateHardwareLive: { cores: number; memory: number } | null;
}

export function useVmPageLiveRefs({
  proxmoxVms,
  queueItems,
  settings,
  templateHardwareLive,
}: UseVmPageLiveRefsParams) {
  const proxmoxVmsRef = useRef(proxmoxVms);
  const queueItemsRef = useRef<VMQueueItem[]>(queueItems);
  const settingsRef = useRef<VMGeneratorSettings | null>(settings);
  const templateHardwareLiveRef = useRef<{ cores: number; memory: number } | null>(
    templateHardwareLive,
  );

  useEffect(() => {
    proxmoxVmsRef.current = proxmoxVms;
  }, [proxmoxVms]);

  useEffect(() => {
    queueItemsRef.current = queueItems;
  }, [queueItems]);

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
