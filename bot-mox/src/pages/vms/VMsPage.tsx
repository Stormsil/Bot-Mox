import { Button, message, Select, Tag, Typography } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { VMListView, VMOperationLog, VMQueuePanel, VMStatusBar } from '../../components/vm';
import { useRefreshOnVmMutationEvents } from '../../entities/vm/api/useRefreshOnVmMutationEvents';
import { useProxmoxTargetsQuery, useVmSettingsQuery } from '../../entities/vm/api/useVmQueries';
import { getVMConfig } from '../../entities/vm/api/vmReadFacade';
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
import { VMPageModals } from './page/VMPageModals';
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
const VM_PROJECT_DISK_FALLBACK_GIB: Record<string, number> = {
  wow_tbc: 128,
  wow_midnight: 256,
};

function estimateProjectDiskBytes(
  settings: VMGeneratorSettings | null | undefined,
  projectId: string,
): number {
  const projectConfig =
    projectId === 'wow_tbc' || projectId === 'wow_midnight'
      ? settings?.projectHardware?.[projectId]
      : undefined;
  const configured = Number(projectConfig?.diskGiB);
  const gib =
    Number.isFinite(configured) && configured > 0
      ? configured
      : (VM_PROJECT_DISK_FALLBACK_GIB[projectId] ?? 128);
  return gib * 1024 ** 3;
}

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
      const activeSettings = explicitSettings || settingsRef.current;
      if (!activeSettings) {
        return null;
      }

      const fallbackCores = normalizeCores(activeSettings.hardware?.cores, 2);
      const fallbackMemory = normalizeMemory(activeSettings.hardware?.memory, 4096);
      const vmId = Number(activeSettings.template?.vmId || 100);
      const node = activeSettings.proxmox?.node || proxmox.node || 'h1';
      const previousTemplate = templateHardwareLiveRef.current || {
        cores: fallbackCores,
        memory: fallbackMemory,
      };

      if (!Number.isFinite(vmId) || vmId < 1) {
        const fallback = { cores: fallbackCores, memory: fallbackMemory };
        setTemplateHardwareLive(fallback);
        return fallback;
      }

      try {
        const config = await getVMConfig(vmId, node);
        const cores = normalizeCores(config.cores, fallbackCores);
        const memory = normalizeMemory(config.memory, fallbackMemory);
        setTemplateHardwareLive({ cores, memory });

        queueItemsRef.current.forEach((item) => {
          if (item.status !== 'pending') return;
          if ((item.resourceMode || 'original') !== 'original') return;

          const itemCores = normalizeCores(item.cores, previousTemplate.cores);
          const itemMemory = normalizeMemory(item.memory, previousTemplate.memory);
          const looksStale =
            item.cores === undefined ||
            item.memory === undefined ||
            (itemCores === previousTemplate.cores && itemMemory === previousTemplate.memory);

          if (looksStale) {
            updateQueueItem(item.id, { cores, memory });
          }
        });

        return { cores, memory };
      } catch {
        const fallback = { cores: fallbackCores, memory: fallbackMemory };
        setTemplateHardwareLive(fallback);
        return fallback;
      }
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
    const autoSelectBest = activeSettings?.storage?.autoSelectBest ?? true;

    const configuredDefaultStorage = String(activeSettings?.storage?.default || '').trim();
    const enabledTargets =
      Array.isArray(activeSettings?.storage?.enabledDisks) &&
      activeSettings.storage.enabledDisks.length > 0
        ? activeSettings.storage.enabledDisks
        : storageOptions.map((opt) => opt.value);

    const estimateBytes = estimateProjectDiskBytes(activeSettings, defaultProject);

    const freeBytesByStorage = new Map<string, number>();
    for (const opt of storageOptions) {
      const used = Number(opt.usedBytes);
      const total = Number(opt.totalBytes);
      if (!Number.isFinite(used) || used < 0 || !Number.isFinite(total) || total <= 0) {
        continue;
      }
      freeBytesByStorage.set(opt.value, Math.max(0, total - used));
    }

    const reservedBytesByStorage = new Map<string, number>();
    for (const item of queueItemsRef.current) {
      if ((item.action || 'create') === 'delete') {
        continue;
      }
      if (!['pending', 'cloned', 'cloning', 'configuring'].includes(item.status)) {
        continue;
      }
      const storage = String(item.storage || '').trim();
      if (!storage) {
        continue;
      }

      const itemProject = item.projectId as VMProjectId;
      const customDiskGiB = Number(item.diskGiB);
      const itemEstimateBytes =
        Number.isFinite(customDiskGiB) && customDiskGiB > 0
          ? customDiskGiB * 1024 ** 3
          : estimateProjectDiskBytes(activeSettings, itemProject);
      reservedBytesByStorage.set(
        storage,
        (reservedBytesByStorage.get(storage) ?? 0) + itemEstimateBytes,
      );
    }

    const chooseStorage = (): string => {
      const candidates =
        enabledTargets.length > 0 ? enabledTargets : storageOptions.map((opt) => opt.value);
      const available = candidates.filter((name) =>
        storageOptions.some((opt) => opt.value === name),
      );
      const pool = available.length > 0 ? available : storageOptions.map((opt) => opt.value);

      if (!autoSelectBest) {
        if (configuredDefaultStorage && pool.includes(configuredDefaultStorage)) {
          return configuredDefaultStorage;
        }
        return pool[0] || 'data';
      }

      let best: { name: string; free: number } | null = null;
      let bestFits: { name: string; free: number } | null = null;

      for (const name of pool) {
        const free = freeBytesByStorage.get(name) ?? 0;
        const reserved = reservedBytesByStorage.get(name) ?? 0;
        const effectiveFree = free - reserved;

        if (!best || effectiveFree > best.free) {
          best = { name, free: effectiveFree };
        }
        if (effectiveFree >= estimateBytes) {
          if (!bestFits || effectiveFree > bestFits.free) {
            bestFits = { name, free: effectiveFree };
          }
        }
      }

      return bestFits?.name || best?.name || pool[0] || configuredDefaultStorage || 'data';
    };

    const storage = chooseStorage();
    const preset = getResourcePreset(defaultProject, defaultMode);

    addToQueue({
      storage,
      storageMode: autoSelectBest ? 'auto' : 'manual',
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
    if (!proxmoxTargetsQuery.error) {
      return;
    }

    message.warning(proxmoxTargetsQuery.error.message || 'Failed to load computers');
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

  const projectOptions: Array<{ value: VMProjectId; label: string }> = [
    { value: 'wow_tbc', label: 'TBC' },
    { value: 'wow_midnight', label: 'Midnight' },
  ];

  const resourcePresets = {
    wow_tbc: {
      label: 'TBC',
      cores: getResourcePreset('wow_tbc', 'project').cores,
      memoryMb: getResourcePreset('wow_tbc', 'project').memory,
      diskGiB: getResourcePreset('wow_tbc', 'project').diskGiB || 128,
    },
    wow_midnight: {
      label: 'Midnight',
      cores: getResourcePreset('wow_midnight', 'project').cores,
      memoryMb: getResourcePreset('wow_midnight', 'project').memory,
      diskGiB: getResourcePreset('wow_midnight', 'project').diskGiB || 256,
    },
  };

  const handleRecreateVm = useCallback(
    (vm: ProxmoxVM) => {
      const vmid = Number(vm.vmid);
      if (!Number.isInteger(vmid) || vmid <= 0) {
        message.error('Invalid VM ID for recreate');
        return;
      }

      const normalizedName = String(vm.name || '').toLowerCase();
      const projectId: VMProjectId = normalizedName.includes('midnight')
        ? 'wow_midnight'
        : 'wow_tbc';
      const preset = getResourcePreset(projectId, 'project');
      const activeSettings = settingsRef.current || settings;
      const storage = String(activeSettings?.storage?.default || '').trim() || 'data';

      const addedDelete = queue.addDeleteToQueue({
        vmid,
        name: vm.name || `VM ${vmid}`,
        projectId,
      });

      queue.addToQueue({
        name: vm.name || `VM ${vmid}`,
        storage,
        storageMode: activeSettings?.storage?.autoSelectBest ? 'auto' : 'manual',
        format: activeSettings?.format?.default || 'raw',
        projectId,
        resourceMode: 'project',
        cores: preset.cores,
        memory: preset.memory,
        diskGiB: preset.diskGiB,
      });

      if (!addedDelete) {
        message.info(
          `Create task added for ${vm.name || `VM ${vmid}`}. Delete task already exists in queue.`,
        );
        return;
      }

      message.success(`Recreate queued: delete + create for ${vm.name || `VM ${vmid}`}`);
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

      <div className={cx('vm-generator-target-strip')}>
        <Typography.Text
          type="secondary"
          style={{
            margin: 0,
            color: 'var(--vmx-text-muted)',
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Computer
        </Typography.Text>
        <Select
          allowClear
          size="small"
          placeholder="Auto (active computer)"
          value={effectiveSelectedTargetId}
          options={proxmoxTargets.map((target) => ({
            value: target.id,
            label: `${target.label}${target.isActive ? ' (active)' : ''}`,
          }))}
          loading={proxmoxTargetsQuery.isLoading || proxmoxTargetsQuery.isFetching}
          onChange={(value) => handleTargetChange(value)}
          style={{ minWidth: 320, maxWidth: 520 }}
        />
        <Button
          size="small"
          onClick={() => {
            void proxmoxTargetsQuery.refetch();
          }}
          loading={proxmoxTargetsQuery.isFetching}
        >
          Refresh Computers
        </Button>
        {!proxmox.sshConfigured && (
          <Tag color="warning">SSH not configured: SSH-only features are disabled</Tag>
        )}
        {proxmox.sshConfigured && !proxmox.sshConnected && (
          <Tag color="error">
            SSH unavailable{proxmox.sshStatusCode ? ` (${proxmox.sshStatusCode})` : ''}: SSH-only
            features are disabled
          </Tag>
        )}
      </div>

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
