import { deleteVM, waitForTask, waitForVmPresence } from '../../../services/vmService';
import type { VMQueueItem } from '../../../types';
import type { VMLog } from '../../useVMLog';
import { normalizeVmId } from './utils';

interface RunDeletePhaseParams {
  pendingDeleteItems: VMQueueItem[];
  cancelRef: { current: boolean };
  targetNode: string;
  proxmoxUser: string;
  updateQueueItem: (id: string, updates: Partial<VMQueueItem>) => void;
  setOperationText: (next: string) => void;
  log: VMLog;
}

export async function runDeletePhase(params: RunDeletePhaseParams): Promise<{
  deleteSuccessCount: number;
  deleteErrorCount: number;
}> {
  const {
    pendingDeleteItems,
    cancelRef,
    targetNode,
    proxmoxUser,
    updateQueueItem,
    setOperationText,
    log,
  } = params;

  if (pendingDeleteItems.length > 0) {
    log.step('Phase 0 - Deleting selected VMs');
  }

  let deleteSuccessCount = 0;
  let deleteErrorCount = 0;

  for (const item of pendingDeleteItems) {
    if (cancelRef.current) {
      log.warn('Processing cancelled by user');
      break;
    }

    const vmId = normalizeVmId(item.targetVmId ?? item.vmId);
    const itemName = String(item.name || '').trim() || (vmId ? `VM ${vmId}` : 'VM');
    const vmTaskKey = `vm:${item.id}`;
    log.startTask(vmTaskKey, `${itemName} - Destroy`, {
      node: targetNode,
      userName: proxmoxUser,
      vmName: itemName,
    });
    log.taskLog(vmTaskKey, 'Delete task added to processing queue');

    if (!vmId) {
      const msg = 'Delete task has invalid VM ID';
      updateQueueItem(item.id, { status: 'error', error: msg });
      log.error(`${itemName} delete failed: ${msg}`, itemName);
      log.finishTask(vmTaskKey, 'error', msg);
      deleteErrorCount += 1;
      continue;
    }

    try {
      updateQueueItem(item.id, { status: 'deleting', vmId });
      setOperationText(`Deleting ${itemName}...`);
      log.info(`Deleting ${itemName} (VM ${vmId})...`, itemName);
      log.table(
        `Delete parameters - ${itemName}`,
        [
          { field: 'VM ID', value: String(vmId) },
          { field: 'Name', value: itemName },
          { field: 'Node', value: targetNode },
          { field: 'Purge', value: 'Yes' },
          { field: 'Destroy unreferenced disks', value: 'Yes' },
        ],
        itemName,
      );

      const deleteResult = await deleteVM(vmId, targetNode, {
        purge: true,
        destroyUnreferencedDisks: true,
      });
      if (deleteResult.upid) {
        log.taskLog(vmTaskKey, `Delete task UPID: ${deleteResult.upid}`);
        const status = await waitForTask(deleteResult.upid, targetNode, {
          timeoutMs: 240_000,
          intervalMs: 1_000,
        });
        if (status.exitstatus && status.exitstatus !== 'OK') {
          throw new Error(`Delete task failed: ${status.exitstatus}`);
        }
      } else {
        log.taskLog(vmTaskKey, 'Delete request returned no UPID, verifying VM removal');
      }

      const deletePresence = await waitForVmPresence(vmId, targetNode, false, {
        timeoutMs: 45_000,
        intervalMs: 1_000,
      });
      if (deletePresence.exists) {
        throw new Error(`VM ${vmId} is still present after delete request`);
      }

      updateQueueItem(item.id, { status: 'done', vmId, error: undefined });
      log.info(`${itemName} deleted successfully`, itemName);
      log.finishTask(vmTaskKey, 'ok', `VM ${vmId} deleted successfully`);
      deleteSuccessCount += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      updateQueueItem(item.id, { status: 'error', error: msg });
      log.error(`${itemName} delete failed: ${msg}`, itemName);
      log.finishTask(vmTaskKey, 'error', msg);
      deleteErrorCount += 1;
    }
  }

  return { deleteSuccessCount, deleteErrorCount };
}
