import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { message } from 'antd';
import {
  VMStatusBar,
  VMQueuePanel,
  VMOperationLog,
} from '../../components/vm';
import { useProxmox } from '../../hooks/useProxmox';
import { useVMLog } from '../../hooks/useVMLog';
import { useVMQueue } from '../../hooks/useVMQueue';
import { useVMKeyboardShortcuts } from '../../hooks/useVMKeyboardShortcuts';
import { getVMSettings } from '../../services/vmSettingsService';
import {
  getVMConfig,
  proxmoxLogin,
} from '../../services/vmService';
import { VMPageModals } from './page/VMPageModals';
import type {
  VMGeneratorSettings,
  VMQueueItem,
  VMResourceMode,
} from '../../types';
import { useDeleteVmWorkflow } from './hooks/useDeleteVmWorkflow';
import { useVmStorageOptions } from './hooks/useVmStorageOptions';
import { useVmWorkspaceLayout } from './hooks/useVmWorkspaceLayout';
import { useVmStartAndQueueActions } from './hooks/useVmStartAndQueueActions';
import {
  getServiceFrameTitle,
  getServiceFrameUrl,
  normalizeCores,
  normalizeMemory,
  type VMServiceKind,
} from './vmPageUtils';
import './VMsPage.css';

type VMProjectId = 'wow_tbc' | 'wow_midnight';
const STORAGE_REFRESH_INTERVAL_MS = 45_000;
export const VMsPage: React.FC = () => {
  const proxmox = useProxmox();
  const log = useVMLog();
  const queue = useVMQueue({
    log,
    usedIds: proxmox.usedIds,
    usedNames: proxmox.usedNames,
    node: proxmox.node,
  });

  const workspaceLayoutRef = useRef<HTMLDivElement | null>(null);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const proxmoxVmsRef = useRef(proxmox.vms);
  const queueItemsRef = useRef<VMQueueItem[]>([]);
  const settingsRef = useRef<VMGeneratorSettings | null>(null);
  const templateHardwareLiveRef = useRef<{ cores: number; memory: number } | null>(null);

  const [settings, setSettings] = useState<VMGeneratorSettings | null>(null);
  const [panelOpen, setPanelOpen] = useState<'settings' | 'preview' | null>(null);
  const [activeService, setActiveService] = useState<VMServiceKind>('proxmox');
  const [templateHardwareLive, setTemplateHardwareLive] = useState<{ cores: number; memory: number } | null>(null);

  useEffect(() => {
    proxmoxVmsRef.current = proxmox.vms;
  }, [proxmox.vms]);

  useEffect(() => {
    queueItemsRef.current = queue.queue;
  }, [queue.queue]);

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
    const timer = window.setInterval(() => {
      void refreshStorageOptions(settings);
    }, STORAGE_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [settings, refreshStorageOptions]);

  const syncTemplateHardwareFromApi = useCallback(
    async (explicitSettings?: VMGeneratorSettings | null): Promise<{ cores: number; memory: number } | null> => {
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
            item.cores === undefined
            || item.memory === undefined
            || (itemCores === previousTemplate.cores && itemMemory === previousTemplate.memory);

          if (looksStale) {
            queue.updateQueueItem(item.id, { cores, memory });
          }
        });

        return { cores, memory };
      } catch {
        const fallback = { cores: fallbackCores, memory: fallbackMemory };
        setTemplateHardwareLive(fallback);
        return fallback;
      }
    },
    [proxmox.node, queue]
  );

  useEffect(() => {
    let active = true;

    getVMSettings().then((loadedSettings) => {
      if (!active) {
        return;
      }

      setSettings(loadedSettings);
      setTemplateHardwareLive({
        cores: normalizeCores(loadedSettings.hardware?.cores, 2),
        memory: normalizeMemory(loadedSettings.hardware?.memory, 4096),
      });

      void syncTemplateHardwareFromApi(loadedSettings);
    });

    return () => {
      active = false;
    };
  }, [syncTemplateHardwareFromApi]);

  useEffect(() => {
    if (!settings) {
      return;
    }

    const timer = window.setInterval(() => {
      void syncTemplateHardwareFromApi(settings);
    }, 15_000);

    return () => window.clearInterval(timer);
  }, [settings, syncTemplateHardwareFromApi]);

  useEffect(() => {
    if (queue.uiState === 'success') {
      void refreshStorageOptions();
    }
  }, [queue.uiState, refreshStorageOptions]);

  useEffect(() => {
    if (activeService === 'proxmox') {
      void proxmoxLogin().catch(() => undefined);
    }
  }, [activeService]);

  const getResourcePreset = useCallback(
    (projectId: VMProjectId, mode: VMResourceMode) => {
      const fallbackCores = 2;
      const fallbackMemory = 4096;
      const templateCores = normalizeCores(templateHardwareLive?.cores ?? settings?.hardware?.cores, fallbackCores);
      const templateMemory = normalizeMemory(templateHardwareLive?.memory ?? settings?.hardware?.memory, fallbackMemory);
      const projectPreset = settings?.projectHardware?.[projectId];
      const projectCores = normalizeCores(projectPreset?.cores, templateCores);
      const projectMemory = normalizeMemory(projectPreset?.memory, templateMemory);

      if (mode === 'project') {
        return { cores: projectCores, memory: projectMemory };
      }

      return { cores: templateCores, memory: templateMemory };
    },
    [settings, templateHardwareLive]
  );

  const handleAddVM = useCallback(async () => {
    const activeSettings = settingsRef.current || settings;
    const defaultProject: VMProjectId = 'wow_tbc';
    const defaultMode: VMResourceMode = 'project';
    const configuredDefaultStorage = String(activeSettings?.storage?.default || '').trim();
    const defaultStorage = storageOptions.some((option) => option.value === configuredDefaultStorage)
      ? configuredDefaultStorage
      : storageOptions[0]?.value || 'data';
    const preset = getResourcePreset(defaultProject, defaultMode);

    queue.addToQueue({
      storage: defaultStorage,
      format: activeSettings?.format?.default || 'raw',
      projectId: defaultProject,
      resourceMode: defaultMode,
      cores: preset.cores,
      memory: preset.memory,
    });
  }, [getResourcePreset, queue, settings, storageOptions]);

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
    setSettings,
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

  const projectOptions = [
    { value: 'wow_tbc', label: 'TBC' },
    { value: 'wow_midnight', label: 'Midnight' },
  ];

  const serviceFrameUrl = useMemo(() => getServiceFrameUrl(activeService), [activeService]);
  const serviceFrameTitle = useMemo(() => getServiceFrameTitle(activeService), [activeService]);

  return (
    <div className={`vm-generator ${isLogResizing ? 'vm-generator--resizing' : ''}`}>
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
        onOpenSettings={() => setPanelOpen('settings')}
        onOpenPreview={() => setPanelOpen('preview')}
        activeTopPanel={panelOpen}
        activeService={activeService}
        onSelectService={setActiveService}
      />

      <div
        ref={workspaceLayoutRef}
        className={`vm-generator-workspace${isWorkspaceResizing ? ' vm-generator-workspace--resizing' : ''}`}
        style={{ gridTemplateColumns: workspaceGridTemplateColumns }}
      >
        <div className="vm-generator-service-pane">
          <iframe
            key={activeService}
            className="vm-generator-service-frame"
            src={serviceFrameUrl}
            title={serviceFrameTitle}
          />
        </div>

        <div
          className="vm-generator-workspace-resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize workspace panes"
          onMouseDown={startWorkspaceResize}
        />

        <div ref={workspaceRef} className="vm-generator-main">
          <div className="vm-generator-queue-wrap">
            <VMQueuePanel
              queue={queue.queue}
              isProcessing={queue.isProcessing}
              isStartActionRunning={isStartActionRunning}
              canStartAll={startableQueueItems.length > 0}
              startingItemId={startingQueueItemId}
              storageOptions={storageOptions}
              projectOptions={projectOptions}
              onAdd={handleAddVM}
              onAddDelete={deleteVm.handleOpenDeleteVmModal}
              onClear={queue.clearQueue}
              onStartAll={handleStartAllReady}
              onStartOne={handleStartOneReady}
              onRemove={queue.removeFromQueue}
              onUpdate={handleQueueUpdate}
            />
          </div>

          <div
            className="vm-generator-log-resizer"
            onMouseDown={startLogResize}
            role="separator"
            aria-orientation="horizontal"
            aria-label="Resize log panel"
          />

          <div className="vm-generator-log-wrap" style={{ height: logHeight }}>
            <VMOperationLog tasks={log.tasks} onClear={log.clear} getFullLog={log.getFullLog} />
          </div>
        </div>
      </div>

      <VMPageModals panelOpen={panelOpen} setPanelOpen={setPanelOpen} deleteVm={deleteVm} />
    </div>
  );
};
