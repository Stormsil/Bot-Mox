import { message } from 'antd';
import { useCallback, useMemo, useRef, useState } from 'react';
import { startAndSendKeyBatch } from '../../../services/vmService';
import type { VMGeneratorSettings, VMQueueItem, VMResourceMode } from '../../../types';

type VMProjectId = 'wow_tbc' | 'wow_midnight';

interface QueueStats {
  total: number;
  pending: number;
  active: number;
  done: number;
  error: number;
}

interface VmQueueController {
  queue: VMQueueItem[];
  processQueue: () => void;
  cancelProcessing: () => void;
  updateQueueItem: (id: string, updates: Partial<VMQueueItem>) => void;
}

interface UseVmStartAndQueueActionsParams {
  queue: VmQueueController;
  settings: VMGeneratorSettings | null;
  proxmoxNode: string;
  refreshVms: () => Promise<void> | void;
  getResourcePreset: (projectId: VMProjectId, mode: VMResourceMode) => { cores: number; memory: number; diskGiB?: number };
  syncTemplateHardwareFromApi: () => Promise<{ cores: number; memory: number } | null>;
  onReset: () => void;
  onAddVM: () => void;
  onCopyLog: () => void;
}

interface UseVmStartAndQueueActionsResult {
  isStartActionRunning: boolean;
  startingQueueItemId: string | null;
  startableQueueItems: VMQueueItem[];
  hasPending: boolean;
  queueStats: QueueStats;
  handleQueueUpdate: (id: string, updates: Partial<VMQueueItem>) => void;
  handleStartAllReady: () => void;
  handleStartOneReady: (queueItemId: string) => void;
  shortcutActions: {
    onStart: () => void;
    onStop: () => void;
    onReset: () => void;
    onAddVM: () => void;
    onCopyLog: () => void;
  };
}

export const useVmStartAndQueueActions = ({
  queue,
  settings,
  proxmoxNode,
  refreshVms,
  getResourcePreset,
  syncTemplateHardwareFromApi,
  onReset,
  onAddVM,
  onCopyLog,
}: UseVmStartAndQueueActionsParams): UseVmStartAndQueueActionsResult => {
  const startActionLockRef = useRef(false);
  const [isStartActionRunning, setIsStartActionRunning] = useState(false);
  const [startingQueueItemId, setStartingQueueItemId] = useState<string | null>(null);

  const handleQueueUpdate = useCallback(
    (id: string, updates: Partial<VMQueueItem>) => {
      const currentItem = queue.queue.find((item) => item.id === id);
      if (!currentItem) {
        return;
      }

      if ((currentItem.action || 'create') === 'delete') {
        queue.updateQueueItem(id, updates);
        return;
      }

      const nextProjectId = (updates.projectId || currentItem.projectId) as VMProjectId;
      const nextMode = (
        updates.resourceMode !== undefined
          ? updates.resourceMode
          : updates.projectId !== undefined
            ? 'project'
            : currentItem.resourceMode || 'project'
      ) as VMResourceMode;

      const hasManualResourceValues = updates.cores !== undefined || updates.memory !== undefined || updates.diskGiB !== undefined;
      const shouldApplyPreset = nextMode !== 'custom' && !hasManualResourceValues && (
        updates.projectId !== undefined || updates.resourceMode !== undefined
      );

      if (shouldApplyPreset) {
        if (nextMode === 'original') {
          void (async () => {
            const liveTemplate = await syncTemplateHardwareFromApi();
            const preset = liveTemplate || getResourcePreset(nextProjectId, nextMode);
            queue.updateQueueItem(id, {
              ...updates,
              projectId: nextProjectId,
              resourceMode: nextMode,
              cores: preset.cores,
              memory: preset.memory,
              diskGiB: undefined,
            });
          })();
          return;
        }

        const preset = getResourcePreset(nextProjectId, nextMode);
        queue.updateQueueItem(id, {
          ...updates,
          projectId: nextProjectId,
          resourceMode: nextMode,
          cores: preset.cores,
          memory: preset.memory,
          diskGiB: preset.diskGiB,
        });
        return;
      }

      queue.updateQueueItem(id, {
        ...updates,
        projectId: nextProjectId,
        resourceMode: nextMode,
      });
    },
    [getResourcePreset, queue, syncTemplateHardwareFromApi]
  );

  const startableQueueItems = useMemo(
    () =>
      queue.queue.filter(
        (item) =>
          (item.action || 'create') === 'create'
          && item.status === 'done'
          && Number.isInteger(Number(item.vmId))
          && Number(item.vmId) > 0
      ),
    [queue.queue]
  );

  const runVmStartAction = useCallback(
    async (vmIds: number[], contextLabel: string) => {
      if (startActionLockRef.current || vmIds.length === 0) {
        return;
      }

      startActionLockRef.current = true;
      setIsStartActionRunning(true);

      try {
        const targetNode = settings?.proxmox?.node || proxmoxNode || 'h1';
        const result = await startAndSendKeyBatch(vmIds, {
          node: targetNode,
          key: 'a',
          repeatCount: 20,
          intervalMs: 1000,
          startupDelayMs: 0,
        });

        if (result.failed === 0) {
          message.success(`${contextLabel}: ${result.ok}/${result.total}`);
        } else {
          const failedPreview = result.results
            .filter((item) => !item.success)
            .slice(0, 2)
            .map((item) => `VM ${item.vmid}: ${item.error || 'Unknown error'}`)
            .join(' | ');
          message.warning(`${contextLabel}: ${result.ok}/${result.total}. ${failedPreview}`);
        }

        await Promise.resolve(refreshVms());
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        message.error(`Start API error: ${errorMessage}`);
      } finally {
        setIsStartActionRunning(false);
        setStartingQueueItemId(null);
        startActionLockRef.current = false;
      }
    },
    [proxmoxNode, refreshVms, settings?.proxmox?.node]
  );

  const handleStartAllReady = useCallback(() => {
    if (isStartActionRunning || startableQueueItems.length === 0) {
      return;
    }

    setStartingQueueItemId(null);
    const vmIds = startableQueueItems
      .map((item) => Number(item.vmId))
      .filter((vmid) => Number.isInteger(vmid) && vmid > 0);

    void runVmStartAction(vmIds, 'Start all completed');
  }, [isStartActionRunning, runVmStartAction, startableQueueItems]);

  const handleStartOneReady = useCallback(
    (queueItemId: string) => {
      if (isStartActionRunning) {
        return;
      }

      const queueItem = queue.queue.find((item) => item.id === queueItemId);
      if (!queueItem || (queueItem.action || 'create') !== 'create' || queueItem.status !== 'done') {
        return;
      }

      const vmid = Number(queueItem.vmId);
      if (!Number.isInteger(vmid) || vmid <= 0) {
        return;
      }

      setStartingQueueItemId(queueItem.id);
      void runVmStartAction([vmid], `VM ${vmid} start completed`);
    },
    [isStartActionRunning, queue.queue, runVmStartAction]
  );

  const hasPending = queue.queue.some((item) => item.status === 'pending');
  const queueStats = useMemo(() => {
    const total = queue.queue.length;
    const pending = queue.queue.filter((item) => item.status === 'pending').length;
    const active = queue.queue.filter(
      (item) =>
        item.status === 'cloning'
        || item.status === 'configuring'
        || item.status === 'provisioning'
        || item.status === 'deleting'
    ).length;
    const done = queue.queue.filter((item) => item.status === 'done').length;
    const error = queue.queue.filter((item) => item.status === 'error').length;
    return { total, pending, active, done, error };
  }, [queue.queue]);

  const shortcutActions = useMemo(
    () => ({
      onStart: queue.processQueue,
      onStop: queue.cancelProcessing,
      onReset,
      onAddVM,
      onCopyLog,
    }),
    [onAddVM, onCopyLog, onReset, queue.cancelProcessing, queue.processQueue]
  );

  return {
    isStartActionRunning,
    startingQueueItemId,
    startableQueueItems,
    hasPending,
    queueStats,
    handleQueueUpdate,
    handleStartAllReady,
    handleStartOneReady,
    shortcutActions,
  };
};
