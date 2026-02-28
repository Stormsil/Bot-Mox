import type { ComponentProps } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRefreshOnVmMutationEvents } from '../../../entities/vm/api/useRefreshOnVmMutationEvents';
import { useProxmoxTargetsQuery, useVmSettingsQuery } from '../../../entities/vm/api/useVmQueries';
import { useDeleteVmWorkflow } from '../../../features/vm-management';
import { useProxmox } from '../../../hooks/useProxmox';
import { useVMKeyboardShortcuts } from '../../../hooks/useVMKeyboardShortcuts';
import { useVMLog } from '../../../hooks/useVMLog';
import { useVMQueue } from '../../../hooks/useVMQueue';
import type { ProxmoxVM, VMGeneratorSettings, VMResourceMode } from '../../../types';
import type { VMWorkspace } from '../../../widgets/vm-workspace';
import { enqueueVmRecreate } from '../page/recreateVm';
import { selectStorageForNewVm } from '../page/storageSelection';
import { useVmOperationLogActions } from './useVmOperationLogActions';
import { useVmPageLiveRefs } from './useVmPageLiveRefs';
import { useVmResourcePresets } from './useVmResourcePresets';
import { useVmStartAndQueueActions } from './useVmStartAndQueueActions';
import { useVmStorageOptions } from './useVmStorageOptions';
import { useVmTargetSelection } from './useVmTargetSelection';
import { useVmTemplateHardwareSync } from './useVmTemplateHardwareSync';

const VM_COMMAND_REFRESH_DEBOUNCE_MS = 500;

export function useVmsPageViewModel(): { workspaceProps: ComponentProps<typeof VMWorkspace> } {
  const proxmox = useProxmox();
  const refreshVMs = proxmox.refreshVMs;
  const log = useVMLog();
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
  const proxmoxTargetsQuery = useProxmoxTargetsQuery();
  const settings = settingsOverride || vmSettingsQuery.data || null;
  const proxmoxTargets = useMemo(() => proxmoxTargetsQuery.data || [], [proxmoxTargetsQuery.data]);

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

  useRefreshOnVmMutationEvents({
    onMutationTerminalEvent: handleVmMutationTerminalEvent,
    debounceMs: VM_COMMAND_REFRESH_DEBOUNCE_MS,
  });

  const { effectiveSelectedTargetId, handleTargetChange } = useVmTargetSelection({
    targets: proxmoxTargets,
    targetsError: (proxmoxTargetsQuery.error as Error | null) || null,
    settings,
    setSettingsOverride,
    checkConnections: proxmox.checkConnections,
    refreshVms: proxmox.refreshVMs,
    refreshStorageOptions,
    syncTemplateHardwareFromApi: (options) => syncTemplateHardwareFromApi(undefined, options),
  });

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

  useVMKeyboardShortcuts(shortcutActions);

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

  return {
    workspaceProps: {
      status: {
        uiState: queue.uiState,
        operationText: queue.operationText,
        isProcessing: queue.isProcessing,
        hasPending,
        queueStats,
        processQueue: queue.processQueue,
        cancelProcessing: queue.cancelProcessing,
      },
      targets: {
        proxmoxTargets,
        selectedTargetId: effectiveSelectedTargetId,
        targetsLoading: proxmoxTargetsQuery.isLoading || proxmoxTargetsQuery.isFetching,
        sshConfigured: proxmox.sshConfigured,
        sshConnected: proxmox.sshConnected,
        sshStatusCode: proxmox.sshStatusCode,
        onTargetChange: handleTargetChange,
        onTargetsRefresh: () => {
          void proxmoxTargetsQuery.refetch();
        },
      },
      proxmoxPane: {
        proxmoxVms: proxmox.vms,
        proxmoxLoading: proxmox.loading,
        proxmoxConnected: proxmox.connected,
        proxmoxNode: proxmox.node,
        refreshVMs: proxmox.refreshVMs,
        onRecreateVm: handleRecreateVm,
      },
      queuePanel: {
        queueItems: queue.queue,
        isStartActionRunning,
        canStartAll: startableQueueItems.length > 0,
        startingQueueItemId,
        storageOptions,
        projectOptions,
        resourcePresets,
        onAddVm: handleAddVM,
        onAddDelete: deleteVm.handleOpenDeleteVmModal,
        onClearQueue: queue.clearQueue,
        onStartAll: handleStartAllReady,
        onStartOne: handleStartOneReady,
        onRemoveQueueItem: queue.removeFromQueue,
        onUpdateQueueItem: handleQueueUpdate,
      },
      logPanel: {
        logTasks: log.tasks,
        onClearLog: log.clear,
        onCancelTask: handleCancelTask,
        getFullLog: log.getFullLog,
      },
      deleteVm,
    },
  };
}
