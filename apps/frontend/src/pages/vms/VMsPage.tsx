import { message } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { VMListView, VMOperationLog, VMQueuePanel, VMStatusBar } from '../../components/vm';
import { useRefreshOnVmMutationEvents } from '../../entities/vm/api/useRefreshOnVmMutationEvents';
import { useProxmoxTargetsQuery, useVmSettingsQuery } from '../../entities/vm/api/useVmQueries';
import {
  getSelectedProxmoxTargetId,
  setSelectedProxmoxTargetId,
  setSelectedProxmoxTargetNode,
} from '../../entities/vm/api/vmSelectionFacade';
import { useProxmox } from '../../hooks/useProxmox';
import { useVMKeyboardShortcuts } from '../../hooks/useVMKeyboardShortcuts';
import { useVMLog } from '../../hooks/useVMLog';
import { useVMQueue } from '../../hooks/useVMQueue';
import type { ProxmoxVM, VMGeneratorSettings, VMQueueItem, VMResourceMode } from '../../types';
import { useDeleteVmWorkflow } from './hooks/useDeleteVmWorkflow';
import { useVmStartAndQueueActions } from './hooks/useVmStartAndQueueActions';
import { useVmStorageOptions } from './hooks/useVmStorageOptions';
import { useVmWorkspaceLayout } from './hooks/useVmWorkspaceLayout';
import { enqueueVmRecreate } from './page/recreateVm';
import { buildResourcePresets, getProjectOptions } from './page/resourcePresets';
import { selectStorageForNewVm } from './page/storageSelection';
import {
  showTargetLoadError,
  syncTemplateHardwareFromApi as syncTemplateHardwareFromApiAction,
} from './page/templateHardwareSync';
import { VMPageModals } from './page/VMPageModals';
import { VmTargetStrip } from './page/VmTargetStrip';
import styles from './VMsPage.module.css';
import { normalizeCores, normalizeMemory } from './vmPageUtils';

function cx(classNames: string): string {
  return classNames
    .split(' ')
    .filter(Boolean)
    .map((name) => styles[name] || name)
    .join(' ');
}

type VMProjectId = 'wow_tbc' | 'wow_midnight';

const VM_COMMAND_REFRESH_DEBOUNCE_MS = 500;
export const VMsPage: React.FC = () => {
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

  const workspaceLayoutRef = useRef<HTMLDivElement | null>(null);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const proxmoxVmsRef = useRef(proxmox.vms);
  const queueItemsRef = useRef<VMQueueItem[]>([]);
  const settingsRef = useRef<VMGeneratorSettings | null>(null);
  const templateHardwareLiveRef = useRef<{ cores: number; memory: number } | null>(null);

  const [settingsOverride, setSettingsOverride] = useState<VMGeneratorSettings | null>(null);
  const [panelOpen, setPanelOpen] = useState<'settings' | null>(null);
  const [templateHardwareLive, setTemplateHardwareLive] = useState<{
    cores: number;
    memory: number;
  } | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string | undefined>(
    () => getSelectedProxmoxTargetId() || undefined,
  );
  const vmSettingsQuery = useVmSettingsQuery();
  const proxmoxTargetsQuery = useProxmoxTargetsQuery();
  const settings = settingsOverride || vmSettingsQuery.data || null;
  const proxmoxTargets = useMemo(() => proxmoxTargetsQuery.data || [], [proxmoxTargetsQuery.data]);

  useEffect(() => {
    proxmoxVmsRef.current = proxmox.vms;
  }, [proxmox.vms]);

  useEffect(() => {
    queueItemsRef.current = queueItems;
  }, [queueItems]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    templateHardwareLiveRef.current = templateHardwareLive;
  }, [templateHardwareLive]);

  const {
    workspaceGridTemplateColumns,
    isWorkspaceResizing,
    startWorkspaceResize,
    logHeight,
    isLogResizing,
    startLogResize,
  } = useVmWorkspaceLayout({
    workspaceLayoutRef,
    workspaceRef,
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

  const syncTemplateHardwareFromApi = useCallback(
    async (
      explicitSettings?: VMGeneratorSettings | null,
    ): Promise<{ cores: number; memory: number } | null> => {
      return syncTemplateHardwareFromApiAction({
        explicitSettings,
        settingsRef,
        proxmoxNode: proxmox.node,
        templateHardwareLiveRef,
        queueItemsRef,
        setTemplateHardwareLive,
        updateQueueItem,
      });
    },
    [proxmox.node, updateQueueItem],
  );

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

  const getResourcePreset = useCallback(
    (projectId: VMProjectId, mode: VMResourceMode) => {
      const fallbackCores = 2;
      const fallbackMemory = 4096;
      const templateCores = normalizeCores(
        templateHardwareLive?.cores ?? settings?.hardware?.cores,
        fallbackCores,
      );
      const templateMemory = normalizeMemory(
        templateHardwareLive?.memory ?? settings?.hardware?.memory,
        fallbackMemory,
      );
      const projectPreset = settings?.projectHardware?.[projectId];
      const projectCores = normalizeCores(projectPreset?.cores, templateCores);
      const projectMemory = normalizeMemory(projectPreset?.memory, templateMemory);
      const projectDiskGiB =
        Number.isFinite(Number(projectPreset?.diskGiB)) && Number(projectPreset?.diskGiB) > 0
          ? Math.max(1, Math.trunc(Number(projectPreset?.diskGiB)))
          : undefined;

      if (mode === 'project' || mode === 'custom') {
        return { cores: projectCores, memory: projectMemory, diskGiB: projectDiskGiB };
      }

      return { cores: templateCores, memory: templateMemory, diskGiB: undefined };
    },
    [settings, templateHardwareLive],
  );

  const handleAddVM = useCallback(async () => {
    const activeSettings = settingsRef.current || settings;
    const defaultProject: VMProjectId = 'wow_tbc';
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
  }, [getResourcePreset, addToQueue, settings, storageOptions]);

  const templateVmId = useMemo(() => {
    const candidate = Number(settings?.template?.vmId ?? 100);
    if (!Number.isFinite(candidate) || candidate < 1) {
      return 100;
    }
    return Math.trunc(candidate);
  }, [settings?.template?.vmId]);

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

  const handleReset = useCallback(() => {
    log.clear();
    proxmox.checkConnections();
    proxmox.refreshVMs();
    void refreshStorageOptions();
    message.info('Reset complete');
  }, [log, proxmox, refreshStorageOptions]);

  const handleCopyLog = useCallback(() => {
    const text = log.getFullLog();
    navigator.clipboard.writeText(text);
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

  const effectiveSelectedTargetId = useMemo(() => {
    const selectedFromState = selectedTargetId
      ? proxmoxTargets.find((target) => target.id === selectedTargetId)
      : undefined;
    if (selectedFromState) {
      return selectedFromState.id;
    }

    const persistedTargetId = getSelectedProxmoxTargetId();
    const selectedFromStorage = persistedTargetId
      ? proxmoxTargets.find((target) => target.id === persistedTargetId)
      : undefined;
    if (selectedFromStorage) {
      return selectedFromStorage.id;
    }

    return proxmoxTargets.find((target) => target.isActive)?.id;
  }, [proxmoxTargets, selectedTargetId]);

  useEffect(() => {
    const selectedTarget = proxmoxTargets.find((target) => target.id === effectiveSelectedTargetId);
    setSelectedProxmoxTargetId(effectiveSelectedTargetId || null);
    setSelectedProxmoxTargetNode(selectedTarget?.node || null);
  }, [effectiveSelectedTargetId, proxmoxTargets]);

  useEffect(() => {
    showTargetLoadError(proxmoxTargetsQuery.error as Error | null);
  }, [proxmoxTargetsQuery.error]);

  const handleTargetChange = useCallback(
    (nextTargetId?: string) => {
      const normalizedTargetId = String(nextTargetId || '').trim() || undefined;
      setSelectedTargetId(normalizedTargetId);
      setSelectedProxmoxTargetId(normalizedTargetId || null);

      const selectedTarget = proxmoxTargets.find((target) => target.id === normalizedTargetId);
      setSelectedProxmoxTargetNode(selectedTarget?.node || null);
      if (selectedTarget?.node) {
        setSettingsOverride((previous) => {
          const baseSettings = previous || settings;
          if (!baseSettings) return previous;

          return {
            ...baseSettings,
            proxmox: {
              ...(baseSettings.proxmox || {}),
              node: selectedTarget.node,
            },
          };
        });
      }

      void proxmox.checkConnections();
      void proxmox.refreshVMs();
      void refreshStorageOptions();
      void syncTemplateHardwareFromApi();
    },
    [proxmox, proxmoxTargets, refreshStorageOptions, settings, syncTemplateHardwareFromApi],
  );

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

  const projectOptions = getProjectOptions();
  const resourcePresets = buildResourcePresets((projectId) =>
    getResourcePreset(projectId, 'project'),
  );

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
    [getResourcePreset, queue, settings],
  );

  return (
    <div className={cx(`vm-generator ${isLogResizing ? 'vm-generator--resizing' : ''}`)}>
      <VMStatusBar
        uiState={queue.uiState}
        operationText={queue.operationText}
        isProcessing={queue.isProcessing}
        hasPending={hasPending}
        queueTotal={queueStats.total}
        pendingCount={queueStats.pending}
        activeCount={queueStats.active}
        doneCount={queueStats.done}
        errorCount={queueStats.error}
        onStart={queue.processQueue}
        onStop={queue.cancelProcessing}
        onOpenSettings={() => {
          setPanelOpen('settings');
        }}
        activeTopPanel={panelOpen}
      />

      <VmTargetStrip
        targets={proxmoxTargets}
        selectedTargetId={effectiveSelectedTargetId}
        loading={proxmoxTargetsQuery.isLoading || proxmoxTargetsQuery.isFetching}
        sshConfigured={proxmox.sshConfigured}
        sshConnected={proxmox.sshConnected}
        sshStatusCode={proxmox.sshStatusCode}
        onChange={handleTargetChange}
        onRefresh={() => {
          void proxmoxTargetsQuery.refetch();
        }}
      />

      <div
        ref={workspaceLayoutRef}
        className={cx(
          `vm-generator-workspace${isWorkspaceResizing ? ' vm-generator-workspace--resizing' : ''}`,
        )}
        style={{ gridTemplateColumns: workspaceGridTemplateColumns }}
      >
        <div className={cx('vm-generator-service-pane')}>
          <VMListView
            vms={proxmox.vms}
            loading={proxmox.loading}
            connected={proxmox.connected}
            node={proxmox.node}
            refreshVMs={proxmox.refreshVMs}
            onRecreate={handleRecreateVm}
          />
        </div>

        <button
          type="button"
          className={cx('vm-generator-workspace-resizer')}
          aria-label="Resize workspace panes"
          onMouseDown={startWorkspaceResize}
        />

        <div ref={workspaceRef} className={cx('vm-generator-main')}>
          <div className={cx('vm-generator-queue-wrap')}>
            <VMQueuePanel
              queue={queue.queue}
              isProcessing={queue.isProcessing}
              isStartActionRunning={isStartActionRunning}
              canStartAll={startableQueueItems.length > 0}
              startingItemId={startingQueueItemId}
              storageOptions={storageOptions}
              projectOptions={projectOptions}
              resourcePresets={resourcePresets}
              onAdd={handleAddVM}
              onAddDelete={deleteVm.handleOpenDeleteVmModal}
              onClear={queue.clearQueue}
              onStartAll={handleStartAllReady}
              onStartOne={handleStartOneReady}
              onRemove={queue.removeFromQueue}
              onUpdate={handleQueueUpdate}
            />
          </div>

          <button
            type="button"
            className={cx('vm-generator-log-resizer')}
            onMouseDown={startLogResize}
            aria-label="Resize log panel"
          />

          <div className={cx('vm-generator-log-wrap')} style={{ height: logHeight }}>
            <VMOperationLog
              tasks={log.tasks}
              onClear={log.clear}
              onCancelTask={handleCancelTask}
              getFullLog={log.getFullLog}
            />
          </div>
        </div>
      </div>

      <VMPageModals
        panelOpen={panelOpen}
        setPanelOpen={setPanelOpen}
        deleteVm={deleteVm}
        storageOptions={storageOptions}
      />
    </div>
  );
};
