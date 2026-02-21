import { cloneVM, listVMs, waitForTask, waitForVmPresence } from '../../../services/vmService';
import type { VMQueueItem } from '../../../types';
import type { VMLog } from '../../useVMLog';
import type { ClonedVmQueueItem } from './phaseTypes';
import { buildStorageAssignments } from './storageAssignments';
import { pickCloneNewId } from './utils';

interface RunClonePhaseParams {
  pendingCreateItems: VMQueueItem[];
  cancelRef: { current: boolean };
  log: VMLog;
  usedIds: Set<number>;
  targetNode: string;
  proxmoxUser: string;
  templateVmId: number;
  settings: {
    storage?: {
      autoSelectBest?: boolean;
      enabledDisks?: unknown[];
      default?: string;
    };
    projectHardware?: Record<string, { diskGiB?: number }>;
  };
  updateQueueItem: (id: string, updates: Partial<VMQueueItem>) => void;
  setOperationText: (next: string) => void;
  compatStoragePlaceholder: string;
}

export async function runClonePhase(params: RunClonePhaseParams): Promise<{
  clonedItems: ClonedVmQueueItem[];
  cloneErrorCount: number;
}> {
  const {
    pendingCreateItems,
    cancelRef,
    log,
    usedIds,
    targetNode,
    proxmoxUser,
    templateVmId,
    settings,
    updateQueueItem,
    setOperationText,
    compatStoragePlaceholder,
  } = params;

  log.step('Phase 1 - Cloning');
  const clonedItems: ClonedVmQueueItem[] = [];
  let cloneErrorCount = 0;
  const reservedVmIds = new Set<number>();

  try {
    const currentVms = await listVMs(targetNode);
    currentVms.forEach((vm) => {
      reservedVmIds.add(vm.vmid);
    });
  } catch {
    usedIds.forEach((id) => {
      reservedVmIds.add(id);
    });
  }

  const storageAssignments = await buildStorageAssignments({
    settings,
    targetNode,
    pendingCreateItems,
    updateQueueItem,
    log,
    compatStoragePlaceholder,
  });

  for (const item of pendingCreateItems) {
    if (cancelRef.current) {
      log.warn('Processing cancelled by user');
      break;
    }

    const itemName = String(item.name || '').trim() || `VM-${Date.now()}`;
    if (itemName !== item.name) {
      updateQueueItem(item.id, { name: itemName });
    }

    const vmTaskKey = `vm:${item.id}`;
    log.startTask(vmTaskKey, `${itemName} - Clone/Configure`, {
      node: targetNode,
      userName: proxmoxUser,
      vmName: itemName,
    });
    log.taskLog(vmTaskKey, 'Task added to processing queue');

    try {
      const cloneNewId = pickCloneNewId(itemName, reservedVmIds);
      reservedVmIds.add(cloneNewId);
      updateQueueItem(item.id, { status: 'cloning' });
      setOperationText(`Cloning ${itemName}...`);
      log.info(`Cloning ${itemName}...`, itemName);

      const effectiveStorage =
        storageAssignments.get(item.id) ||
        String(item.storage || '').trim() ||
        (() => {
          const configuredDefault = String(settings.storage?.default || '').trim();
          return configuredDefault.toLowerCase() === compatStoragePlaceholder
            ? ''
            : configuredDefault;
        })() ||
        'data';

      log.table(
        `Clone parameters - ${itemName}`,
        [
          { field: 'Template', value: String(templateVmId) },
          { field: 'New VM ID', value: String(cloneNewId) },
          { field: 'Name', value: itemName },
          { field: 'Storage', value: effectiveStorage },
          { field: 'Format', value: item.format },
          { field: 'Full clone', value: 'Yes' },
          { field: 'Node', value: targetNode },
        ],
        itemName,
      );
      log.taskLog(
        vmTaskKey,
        `Template=${templateVmId}, newid=${cloneNewId}, storage=${effectiveStorage}, format=${item.format}`,
      );

      const cloneResult = await cloneVM({
        templateVmId,
        newid: cloneNewId,
        name: itemName,
        storage: effectiveStorage,
        format: item.format,
        full: true,
        node: targetNode,
      });

      log.debug(`UPID: ${cloneResult.upid}`, itemName);
      log.taskLog(vmTaskKey, `Clone task UPID: ${cloneResult.upid}`);

      if (cancelRef.current) {
        log.taskLog(vmTaskKey, 'Cancelled by user', 'warn');
        log.finishTask(vmTaskKey, 'cancelled', 'Cancelled by user');
        continue;
      }

      const cloneStatus = await waitForTask(cloneResult.upid, targetNode, {
        timeoutMs: 300_000,
        intervalMs: 1_000,
      });
      if (cloneStatus.exitstatus && cloneStatus.exitstatus !== 'OK') {
        throw new Error(`Clone task failed: ${cloneStatus.exitstatus}`);
      }
      log.debug(`Clone task finished with status: ${cloneStatus.exitstatus || 'OK'}`, item.name);

      const newVmId = cloneNewId;

      const clonePresence = await waitForVmPresence(newVmId, targetNode, true, {
        timeoutMs: 45_000,
        intervalMs: 1_000,
      });
      if (!clonePresence.exists) {
        throw new Error(`Clone task finished, but VM ${newVmId} not found on node ${targetNode}`);
      }

      updateQueueItem(item.id, { status: 'cloned', vmId: newVmId });
      clonedItems.push({ item, vmId: newVmId });
      log.info(`Clone complete - VM ID: ${newVmId}`, itemName);
      log.taskLog(vmTaskKey, `Clone complete - VM ID ${newVmId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      updateQueueItem(item.id, { status: 'error', error: msg });
      log.error(`${itemName} clone failed: ${msg}`, itemName);
      log.finishTask(vmTaskKey, 'error', msg);
      cloneErrorCount += 1;
    }
  }

  return { clonedItems, cloneErrorCount };
}
