import type React from 'react';
import { useRef, useState } from 'react';
import { VMListView, VMOperationLog, VMQueuePanel, VMStatusBar } from '../../../components/vm';
import type { ProxmoxTargetInfo } from '../../../entities/vm/api/vmReadFacade';
import type { ProxmoxVM, VMStorageOption } from '../../../entities/vm/model/types';
import { cx } from '../../../pages/vms/page/cx';
import { VMPageModals } from '../../../pages/vms/page/VMPageModals';
import { VmTargetStrip } from '../../../pages/vms/page/VmTargetStrip';
import { useVmWorkspaceLayout } from '../model/useVmWorkspaceLayout';

type PanelOpenState = 'settings' | null;

interface VmWorkspaceStatusProps {
  uiState: 'ready' | 'working' | 'success' | 'error';
  operationText: string;
  isProcessing: boolean;
  hasPending: boolean;
  queueStats: {
    total: number;
    pending: number;
    active: number;
    done: number;
    error: number;
  };
  processQueue: () => void;
  cancelProcessing: () => void;
}

interface VmWorkspaceTargetsProps {
  proxmoxTargets: ProxmoxTargetInfo[];
  selectedTargetId?: string;
  targetsLoading: boolean;
  sshConfigured: boolean;
  sshConnected: boolean;
  sshStatusCode: string | null;
  onTargetChange: (targetId?: string) => void | Promise<void>;
  onTargetsRefresh: () => void;
}

interface VmWorkspaceProxmoxPaneProps {
  proxmoxVms: ProxmoxVM[];
  proxmoxLoading: boolean;
  proxmoxConnected: boolean;
  proxmoxNode: string;
  refreshVMs: () => Promise<void>;
  onRecreateVm: (vm: ProxmoxVM) => void;
}

interface VmWorkspaceQueueProps {
  queueItems: Parameters<typeof VMQueuePanel>[0]['queue'];
  isStartActionRunning: boolean;
  canStartAll: boolean;
  startingQueueItemId: string | null;
  storageOptions: VMStorageOption[];
  projectOptions: Parameters<typeof VMQueuePanel>[0]['projectOptions'];
  resourcePresets: Parameters<typeof VMQueuePanel>[0]['resourcePresets'];
  onAddVm: () => void;
  onAddDelete?: () => void;
  onClearQueue: () => void;
  onStartAll?: () => void;
  onStartOne?: (id: string) => void;
  onRemoveQueueItem: (id: string) => void;
  onUpdateQueueItem: (
    id: string,
    updates: Partial<Parameters<typeof VMQueuePanel>[0]['queue'][number]>,
  ) => void;
}

interface VmWorkspaceLogProps {
  logTasks: Parameters<typeof VMOperationLog>[0]['tasks'];
  onClearLog: () => void | Promise<void>;
  onCancelTask: (taskId: string) => void;
  getFullLog: () => string;
}

interface VMWorkspaceProps {
  status: VmWorkspaceStatusProps;
  targets: VmWorkspaceTargetsProps;
  proxmoxPane: VmWorkspaceProxmoxPaneProps;
  queuePanel: VmWorkspaceQueueProps;
  logPanel: VmWorkspaceLogProps;
  deleteVm: React.ComponentProps<typeof VMPageModals>['deleteVm'];
}

export const VMWorkspace: React.FC<VMWorkspaceProps> = ({
  status,
  targets,
  proxmoxPane,
  queuePanel,
  logPanel,
  deleteVm,
}) => {
  const [panelOpen, setPanelOpen] = useState<PanelOpenState>(null);
  const workspaceLayoutRef = useRef<HTMLDivElement | null>(null);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
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

  return (
    <div className={cx(`vm-generator ${isLogResizing ? 'vm-generator--resizing' : ''}`)}>
      <VMStatusBar
        uiState={status.uiState}
        operationText={status.operationText}
        isProcessing={status.isProcessing}
        hasPending={status.hasPending}
        queueTotal={status.queueStats.total}
        pendingCount={status.queueStats.pending}
        activeCount={status.queueStats.active}
        doneCount={status.queueStats.done}
        errorCount={status.queueStats.error}
        onStart={status.processQueue}
        onStop={status.cancelProcessing}
        onOpenSettings={() => {
          setPanelOpen('settings');
        }}
        activeTopPanel={panelOpen}
      />

      <VmTargetStrip
        targets={targets.proxmoxTargets}
        selectedTargetId={targets.selectedTargetId}
        loading={targets.targetsLoading}
        sshConfigured={targets.sshConfigured}
        sshConnected={targets.sshConnected}
        sshStatusCode={targets.sshStatusCode}
        onChange={targets.onTargetChange}
        onRefresh={targets.onTargetsRefresh}
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
            vms={proxmoxPane.proxmoxVms}
            loading={proxmoxPane.proxmoxLoading}
            connected={proxmoxPane.proxmoxConnected}
            node={proxmoxPane.proxmoxNode}
            refreshVMs={proxmoxPane.refreshVMs}
            onRecreate={proxmoxPane.onRecreateVm}
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
              queue={queuePanel.queueItems}
              isProcessing={status.isProcessing}
              isStartActionRunning={queuePanel.isStartActionRunning}
              canStartAll={queuePanel.canStartAll}
              startingItemId={queuePanel.startingQueueItemId}
              storageOptions={queuePanel.storageOptions}
              projectOptions={queuePanel.projectOptions}
              resourcePresets={queuePanel.resourcePresets}
              onAdd={queuePanel.onAddVm}
              onAddDelete={queuePanel.onAddDelete}
              onClear={queuePanel.onClearQueue}
              onStartAll={queuePanel.onStartAll}
              onStartOne={queuePanel.onStartOne}
              onRemove={queuePanel.onRemoveQueueItem}
              onUpdate={queuePanel.onUpdateQueueItem}
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
              tasks={logPanel.logTasks}
              onClear={logPanel.onClearLog}
              onCancelTask={logPanel.onCancelTask}
              getFullLog={logPanel.getFullLog}
            />
          </div>
        </div>
      </div>

      <VMPageModals
        panelOpen={panelOpen}
        setPanelOpen={setPanelOpen}
        deleteVm={deleteVm}
        storageOptions={queuePanel.storageOptions}
      />
    </div>
  );
};
