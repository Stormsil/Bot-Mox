import { getVMSettings } from '../../../services/vmSettingsService';
import type { VMHardwareConfig } from '../../../types';
import { runClonePhase } from './clonePhase';
import { runConfigurePhase } from './configurePhase';
import { DEFAULT_HARDWARE } from './constants';
import { runDeletePhase } from './deletePhase';
import { runProvisioningIsoPhase } from './provisioningPhase';
import { resolveBatchUiState, resolveDeleteOnlyUiState } from './queueUiState';
import { resolveTemplateHardware } from './templateResources';
import type { ProcessVmQueueContext } from './types';
import { normalizeCores, normalizeMemory, normalizeProxmoxUsername, sleep } from './utils';

const LEGACY_STORAGE_PLACEHOLDER = 'disk';

export async function processVmQueue(context: ProcessVmQueueContext): Promise<void> {
  const {
    log,
    usedIds,
    node,
    queueRef,
    cancelRef,
    setIsProcessing,
    setUiState,
    setOperationText,
    setReadyVmIds,
    updateQueueItem,
  } = context;
  cancelRef.current = false;
  setIsProcessing(true);
  setUiState('working');
  setReadyVmIds([]);

  try {
    const settings = await getVMSettings();
    const targetNode = node || settings.proxmox?.node || 'h1';
    const proxmoxUser = normalizeProxmoxUsername(settings.proxmox?.username);
    const templateVmId = settings.template?.vmId || 100;
    const hardwareDefaults: VMHardwareConfig = {
      ...DEFAULT_HARDWARE,
      ...(settings.hardware || {}),
    };
    const settingsTemplateCores = normalizeCores(hardwareDefaults.cores, DEFAULT_HARDWARE.cores);
    const settingsTemplateMemory = normalizeMemory(
      hardwareDefaults.memory,
      DEFAULT_HARDWARE.memory,
    );
    const { liveTemplateCores, liveTemplateMemory } = await resolveTemplateHardware({
      templateVmId,
      targetNode,
      settingsTemplateCores,
      settingsTemplateMemory,
      log,
    });

    const pendingItems = queueRef.current.filter((item) => item.status === 'pending');
    if (pendingItems.length === 0) {
      log.warn('No pending items in queue');
      setIsProcessing(false);
      setUiState('ready');
      return;
    }

    const pendingDeleteItems = pendingItems.filter(
      (item) => (item.action || 'create') === 'delete',
    );
    const pendingCreateItems = pendingItems.filter(
      (item) => (item.action || 'create') !== 'delete',
    );
    log.step(
      `Starting batch processing: total=${pendingItems.length}, create=${pendingCreateItems.length}, delete=${pendingDeleteItems.length}`,
    );

    const { deleteSuccessCount, deleteErrorCount } = await runDeletePhase({
      pendingDeleteItems,
      cancelRef,
      targetNode,
      proxmoxUser,
      updateQueueItem,
      setOperationText,
      log,
    });

    if (cancelRef.current) {
      setIsProcessing(false);
      setUiState('error');
      setOperationText('');
      return;
    }

    if (pendingCreateItems.length === 0) {
      setUiState(resolveDeleteOnlyUiState({ deleteSuccessCount, deleteErrorCount }));
      setIsProcessing(false);
      setOperationText('');
      return;
    }

    const { clonedItems, cloneErrorCount } = await runClonePhase({
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
      legacyStoragePlaceholder: LEGACY_STORAGE_PLACEHOLDER,
    });

    if (cancelRef.current) {
      log.warn('Processing cancelled after clone phase');
      for (const { item } of clonedItems) {
        log.finishTask(`vm:${item.id}`, 'cancelled', 'Cancelled by user');
      }
      setIsProcessing(false);
      setUiState('error');
      setOperationText('');
      return;
    }

    if (clonedItems.length === 0) {
      log.error('No VMs were cloned successfully');
      setIsProcessing(false);
      setUiState('error');
      setOperationText('');
      return;
    }

    log.step('Waiting 5 seconds before configuration phase...');
    setOperationText('Waiting before configuration...');
    await sleep(5000);

    const { completedVmIds, configErrorCount } = await runConfigurePhase({
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
    });

    await runProvisioningIsoPhase({
      completedVmIds,
      clonedItems,
      cancelRef,
      queueRef,
      updateQueueItem,
      setOperationText,
      log,
      targetNode,
    });

    const totalErrorCount = deleteErrorCount + cloneErrorCount + configErrorCount;
    const finalUiState = resolveBatchUiState({
      completedVmCount: completedVmIds.length,
      totalErrorCount,
    });
    if (completedVmIds.length > 0) {
      setReadyVmIds(completedVmIds);
      log.step(`Done! Ready to start VMs via API: ${completedVmIds.join(', ')}`);
      if (totalErrorCount > 0) {
        log.warn(
          `Batch completed with errors: delete=${deleteErrorCount}, clone=${cloneErrorCount}, configure=${configErrorCount}`,
        );
      }
    } else {
      if (totalErrorCount > 0) {
        log.warn(
          `Batch completed with errors: delete=${deleteErrorCount}, clone=${cloneErrorCount}, configure=${configErrorCount}`,
        );
      }
    }
    setUiState(finalUiState);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unexpected queue processing error';
    const fallbackStatus = cancelRef.current ? 'cancelled' : 'error';
    for (const queueItem of queueRef.current) {
      if (queueItem.status === 'done' || queueItem.status === 'error') {
        continue;
      }
      log.finishTask(`vm:${queueItem.id}`, fallbackStatus, msg);
    }
    log.error(msg);
    setUiState('error');
  }

  setIsProcessing(false);
  setOperationText('');
}
