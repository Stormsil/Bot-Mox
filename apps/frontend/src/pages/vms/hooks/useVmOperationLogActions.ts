import { message } from 'antd';
import { useCallback } from 'react';
import type { VMQueueItemStatus } from '../../../shared/types';
import { useVmWorkspaceLogTasks } from '../../../widgets/vm-workspace/model/useVmWorkspaceStore';

interface VmLogTask {
  id: string;
  key?: string;
  status: string;
  vmName?: string;
}

interface VmLogPort {
  clear: () => void;
  getFullLog: () => string;
  cancelTask: (taskId: string, reason: string) => boolean;
  warn: (message: string, itemName?: string) => void;
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
  const tasks = useVmWorkspaceLogTasks();

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
      const task: VmLogTask | undefined = tasks.find((entry) => entry.id === taskId);
      if (!task || task.status !== 'running') {
        return;
      }

      queue.cancelProcessing();
      const cancelled = log.cancelTask(taskId, 'Task cancelled by user from Operation Console');
      if (!cancelled) {
        return;
      }

      const taskKey = String(task.key || '').trim();
      if (!taskKey.startsWith('vm:')) {
        log.warn(
          `Task ${task.id} cancellation has no queue link key; queue item patch skipped.`,
          task.vmName,
        );
        return;
      }

      const queueItemId = taskKey.slice(3).trim();
      if (!queueItemId) {
        log.warn(
          `Task ${task.id} cancellation has malformed queue link key; patch skipped.`,
          task.vmName,
        );
        return;
      }

      queue.updateQueueItem(queueItemId, {
        status: 'error',
        error: 'Cancelled by user',
      });
    },
    [log, queue, tasks],
  );

  return {
    handleReset,
    handleCopyLog,
    handleCancelTask,
  };
}
