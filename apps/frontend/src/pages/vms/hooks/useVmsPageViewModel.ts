import { useCallback, useEffect, useMemo, useState } from 'react';
import { useVmSettingsQuery } from '../../../entities/vm/api/useVmQueries';
import { useDeleteVmWorkflow } from '../../../features/vm-management';
import { useProxmox } from '../../../features/vm-management/model/useProxmox';
import { useVMLog } from '../../../features/vm-management/model/useVMLog';
import { useVMQueue } from '../../../features/vm-management/model/useVMQueue';
import type { ProxmoxVM, VMGeneratorSettings, VMResourceMode } from '../../../shared/types';
import {
  useVmWorkspaceLogsActions,
  useVmWorkspaceQueueActions,
} from '../../../widgets/vm-workspace/model/useVmWorkspaceStore';
import { enqueueVmRecreate } from '../page/recreateVm';
import { selectStorageForNewVm } from '../page/storageSelection';
import { useVmOperationLogActions } from './useVmOperationLogActions';
import { useVmPageLiveRefs } from './useVmPageLiveRefs';
import { useVmResourcePresets } from './useVmResourcePresets';
import { useVmStartAndQueueActions } from './useVmStartAndQueueActions';
import { useVmStorageOptions } from './useVmStorageOptions';
import { useVmTemplateHardwareSync } from './useVmTemplateHardwareSync';

export const VM_COMMAND_REFRESH_DEBOUNCE_MS = 500;

export function useVmsPageViewModel() {
  const proxmox = useProxmox();
  const refreshVMs = proxmox.refreshVMs;
  const log = useVMLog();
  const { setTasks: setWorkspaceLogTasks } = useVmWorkspaceLogsActions();
  const { setItems: setWorkspaceQueueItems } = useVmWorkspaceQueueActions();
  const queue = useVMQueue({
    log,
    usedIds: proxmox.usedIds,
    usedNames: proxmox.usedNames,
    node: proxmox.node,
  });
  const queueItems = queue.queue;
  const updateQueueItem = queue.updateQueueItem;
  const addToQueue = queue.addToQueue;

  const [settingsOverride, setSettingsOverride] = useState<VMGeneratorSettings | null>(null);
  const [templateHardwareLive, setTemplateHardwareLive] = useState<{
    cores: number;
    memory: number;
  } | null>(null);
  const vmSettingsQuery = useVmSettingsQuery();
  const settings = settingsOverride || vmSettingsQuery.data || null;

  const { proxmoxVmsRef, queueItemsRef, settingsRef, templateHardwareLiveRef } = useVmPageLiveRefs({
    proxmoxVms: proxmox.vms,
    queueItems,
    settings,
    templateHardwareLive,
  });

  const { storageOptions, refreshStorageOptions } = useVmStorageOptions({
    settings,
    proxmoxNode: proxmox.node,
    proxmoxVmsRef,
  });

  useEffect(() => {
    setWorkspaceLogTasks(log.tasks);
  }, [log.tasks, setWorkspaceLogTasks]);

  useEffect(() => {
    setWorkspaceQueueItems(queue.queue);
  }, [queue.queue, setWorkspaceQueueItems]);

  useEffect(() => {
    if (!settings) {
      return;
    }
    void refreshStorageOptions(settings);
  }, [settings, refreshStorageOptions]);

  const syncTemplateHardwareFromApi = useVmTemplateHardwareSync({
    settingsRef,
    proxmoxNode: proxmox.node,
    templateHardwareLiveRef,
    queueItemsRef,
    setTemplateHardwareLive,
    updateQueueItem,
  });

  useEffect(() => {
    if (queue.uiState === 'success') {
      void refreshStorageOptions();
    }
  }, [queue.uiState, refreshStorageOptions]);

  const handleVmMutationTerminalEvent = useCallback(() => {
    void refreshVMs();
    void refreshStorageOptions();
    void syncTemplateHardwareFromApi();
  }, [refreshVMs, refreshStorageOptions, syncTemplateHardwareFromApi]);

  const refreshAfterTargetChange = useCallback(
    (options?: { isCurrent?: () => boolean }) => {
      const isCurrent = options?.isCurrent || (() => true);
      return Promise.allSettled([
        Promise.resolve().then(() => (isCurrent() ? proxmox.checkConnections() : undefined)),
        Promise.resolve().then(() => (isCurrent() ? proxmox.refreshVMs() : undefined)),
        Promise.resolve().then(() => (isCurrent() ? refreshStorageOptions() : undefined)),
        Promise.resolve().then(() =>
          isCurrent() ? syncTemplateHardwareFromApi(undefined, { isCurrent }) : undefined,
        ),
      ]);
    },
    [proxmox, refreshStorageOptions, syncTemplateHardwareFromApi],
  );

  const { templateVmId, getResourcePreset, projectOptions, resourcePresets } = useVmResourcePresets(
    {
      settings,
      templateHardwareLive,
    },
  );

  const handleAddVM = useCallback(async () => {
    const activeSettings = settingsRef.current || settings;
    const defaultProject = 'wow_tbc';
    const defaultMode: VMResourceMode = 'project';
    const storage = selectStorageForNewVm({
      settings: activeSettings,
      storageOptions,
      queueItems: queueItemsRef.current,
      defaultProjectId: defaultProject,
    });
    const preset = getResourcePreset(defaultProject, defaultMode);

    addToQueue({
      storage,
      storageMode: (activeSettings?.storage?.autoSelectBest ?? true) ? 'auto' : 'manual',
      format: activeSettings?.format?.default || 'raw',
      projectId: defaultProject,
      resourceMode: defaultMode,
      cores: preset.cores,
      memory: preset.memory,
      diskGiB: preset.diskGiB,
    });
  }, [getResourcePreset, addToQueue, settings, storageOptions, queueItemsRef, settingsRef]);

  const deleteVm = useDeleteVmWorkflow({
    queue: {
      queue: queue.queue,
      addDeleteTasks: queue.addDeleteTasks,
    },
    proxmoxVms: proxmox.vms,
    refreshVms: proxmox.refreshVMs,
    templateVmId,
    settings,
    setSettings: setSettingsOverride,
  });

  const { handleReset, handleCopyLog, handleCancelTask } = useVmOperationLogActions({
    log,
    queue,
    proxmox,
    refreshStorageOptions,
  });

  const {
    isStartActionRunning,
    startingQueueItemId,
    startableQueueItems,
    hasPending,
    queueStats,
    handleQueueUpdate,
    handleStartAllReady,
    handleStartOneReady,
    shortcutActions,
  } = useVmStartAndQueueActions({
    queue: {
      queue: queue.queue,
      processQueue: queue.processQueue,
      cancelProcessing: queue.cancelProcessing,
      updateQueueItem: queue.updateQueueItem,
    },
    settings,
    proxmoxNode: proxmox.node,
    refreshVms: proxmox.refreshVMs,
    getResourcePreset,
    syncTemplateHardwareFromApi: () => syncTemplateHardwareFromApi(),
    onReset: handleReset,
    onAddVM: () => {
      void handleAddVM();
    },
    onCopyLog: handleCopyLog,
  });

  const handleRecreateVm = useCallback(
    (vm: ProxmoxVM) => {
      const activeSettings = settingsRef.current || settings;
      enqueueVmRecreate({
        vm,
        settings: activeSettings,
        queue,
        getProjectPreset: (projectId) => getResourcePreset(projectId, 'project'),
      });
    },
    [getResourcePreset, queue, settings, settingsRef],
  );

  const proxmoxStatus = useMemo(
    () => ({
      sshConfigured: proxmox.sshConfigured,
      sshConnected: proxmox.sshConnected,
      sshStatusCode: proxmox.sshStatusCode,
    }),
    [proxmox.sshConfigured, proxmox.sshConnected, proxmox.sshStatusCode],
  );

  return {
    proxmoxStatus,
    queue,
    log,
    deleteVm,
    storageOptions,
    projectOptions,
    resourcePresets,
    refreshAfterTargetChange,
    handleRecreateVm,
    handleAddVM,
    handleQueueUpdate,
    handleStartAllReady,
    handleStartOneReady,
    handleCancelTask,
    hasPending,
    queueStats,
    isStartActionRunning,
    startableQueueItems,
    startingQueueItemId,
    shortcutActions,
    handleVmMutationTerminalEvent,
  };
}
