import { message } from 'antd';
import { useCallback } from 'react';
import type { VMQueueItemStatus } from '../../../types';

interface VmLogTask {
  id: string;
  key?: string;
  status: string;
}

interface VmLogPort {
  tasks: VmLogTask[];
  clear: () => void;
  getFullLog: () => string;
  cancelTask: (taskId: string, reason: string) => boolean;
}

interface VmQueuePort {
  updateQueueItem: (
    itemId: string,
    patch: {
      status?: VMQueueItemStatus;
      error?: string;
    },
  ) => void;
  cancelProcessing: () => void;
}

interface VmProxmoxPort {
  checkConnections: () => Promise<unknown>;
  refreshVMs: () => Promise<unknown>;
}

interface UseVmOperationLogActionsParams {
  log: VmLogPort;
  queue: VmQueuePort;
  proxmox: VmProxmoxPort;
  refreshStorageOptions: () => Promise<unknown>;
}

interface UseVmOperationLogActionsResult {
  handleReset: () => void;
  handleCopyLog: () => void;
  handleCancelTask: (taskId: string) => void;
}

export function useVmOperationLogActions({
  log,
  queue,
  proxmox,
  refreshStorageOptions,
}: UseVmOperationLogActionsParams): UseVmOperationLogActionsResult {
  const handleReset = useCallback(() => {
    log.clear();
    void proxmox.checkConnections();
    void proxmox.refreshVMs();
    void refreshStorageOptions();
    message.info('Reset complete');
  }, [log, proxmox, refreshStorageOptions]);

  const handleCopyLog = useCallback(() => {
    const text = log.getFullLog();
    void navigator.clipboard.writeText(text);
    message.success('Log copied');
  }, [log]);

  const handleCancelTask = useCallback(
    (taskId: string) => {
      const task = log.tasks.find((entry) => entry.id === taskId);
      if (!task || task.status !== 'running') {
        return;
      }

      queue.cancelProcessing();
      const cancelled = log.cancelTask(taskId, 'Task cancelled by user from Operation Console');
      if (!cancelled) {
        return;
      }

      const queueItemId = String(task.key || '').startsWith('vm:') ? String(task.key).slice(3) : '';
      if (queueItemId) {
        queue.updateQueueItem(queueItemId, {
          status: 'error',
          error: 'Cancelled by user',
        });
      }
    },
    [log, queue],
  );

  return {
    handleReset,
    handleCopyLog,
    handleCancelTask,
  };
}
