import type { VMQueueItem } from '../../../types';
import type { VMLog } from '../../useVMLog';
import { configureVmItem } from './configureVmItem';
import type { ClonedVmQueueItem } from './phaseTypes';

interface RunConfigurePhaseParams {
  clonedItems: ClonedVmQueueItem[];
  cancelRef: { current: boolean };
  targetNode: string;
  liveTemplateCores: number;
  liveTemplateMemory: number;
  settingsTemplateCores: number;
  settingsTemplateMemory: number;
  settings: {
    projectHardware?: Record<string, { cores?: number; memory?: number; diskGiB?: number }>;
  };
  updateQueueItem: (id: string, updates: Partial<VMQueueItem>) => void;
  setOperationText: (next: string) => void;
  log: VMLog;
}

export async function runConfigurePhase(params: RunConfigurePhaseParams): Promise<{
  completedVmIds: number[];
  configErrorCount: number;
}> {
  const {
    clonedItems,
    cancelRef,
    targetNode,
    liveTemplateCores,
    liveTemplateMemory,
    settingsTemplateCores,
    settingsTemplateMemory,
    settings,
    updateQueueItem,
    setOperationText,
    log,
  } = params;

  log.step('Phase 2 - Configuration');
  const completedVmIds: number[] = [];
  let configErrorCount = 0;

  for (const clonedItem of clonedItems) {
    const { item } = clonedItem;
    const vmTaskKey = `vm:${item.id}`;

    if (cancelRef.current) {
      log.warn('Processing cancelled by user');
      log.finishTask(vmTaskKey, 'cancelled', 'Cancelled by user');
      break;
    }

    try {
      const vmId = await configureVmItem({
        clonedItem,
        cancelRef,
        targetNode,
        liveTemplateCores,
        liveTemplateMemory,
        settingsTemplateCores,
        settingsTemplateMemory,
        settings,
        updateQueueItem,
        setOperationText,
        log,
      });
      completedVmIds.push(vmId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      updateQueueItem(item.id, { status: 'error', error: msg });
      log.error(`${item.name} configuration failed: ${msg}`, item.name);
      const failStatus = cancelRef.current ? 'cancelled' : 'error';
      log.finishTask(vmTaskKey, failStatus, msg);
      configErrorCount += 1;
    }
  }

  if (cancelRef.current) {
    for (const { item } of clonedItems) {
      log.finishTask(`vm:${item.id}`, 'cancelled', 'Cancelled by user');
    }
  }

  return { completedVmIds, configErrorCount };
}
