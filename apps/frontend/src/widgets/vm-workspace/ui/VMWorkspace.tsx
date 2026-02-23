import type React from 'react';
import { VMListView, VMOperationLog, VMQueuePanel, VMStatusBar } from '../../../components/vm';
import type { ProxmoxTargetInfo } from '../../../entities/vm/api/vmReadFacade';
import type { ProxmoxVM, VMStorageOption } from '../../../entities/vm/model/types';
import { cx } from '../../../pages/vms/page/cx';
import { VMPageModals } from '../../../pages/vms/page/VMPageModals';
import { VmTargetStrip } from '../../../pages/vms/page/VmTargetStrip';

type PanelOpenState = 'settings' | null;

interface VMWorkspaceProps {
  isLogResizing: boolean;
  queueUiState: 'ready' | 'working' | 'success' | 'error';
  queueOperationText: string;
  queueIsProcessing: boolean;
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
  panelOpen: PanelOpenState;
  setPanelOpen: React.Dispatch<React.SetStateAction<PanelOpenState>>;
  proxmoxTargets: ProxmoxTargetInfo[];
  selectedTargetId?: string;
  targetsLoading: boolean;
  sshConfigured: boolean;
  sshConnected: boolean;
  sshStatusCode: string | null;
  onTargetChange: (targetId?: string) => void | Promise<void>;
  onTargetsRefresh: () => void;
  workspaceLayoutRef: React.RefObject<HTMLDivElement | null>;
  workspaceRef: React.RefObject<HTMLDivElement | null>;
  workspaceGridTemplateColumns: string;
  isWorkspaceResizing: boolean;
  startWorkspaceResize: (event: React.MouseEvent<HTMLButtonElement>) => void;
  proxmoxVms: ProxmoxVM[];
  proxmoxLoading: boolean;
  proxmoxConnected: boolean;
  proxmoxNode: string;
  refreshVMs: () => Promise<void>;
  onRecreateVm: (vm: ProxmoxVM) => void;
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
  onUpdateQueueItem: (id: string, updates: Partial<Parameters<typeof VMQueuePanel>[0]['queue'][number]>) => void;
  startLogResize: (event: React.MouseEvent<HTMLButtonElement>) => void;
  logHeight: number;
  logTasks: Parameters<typeof VMOperationLog>[0]['tasks'];
  onClearLog: () => void | Promise<void>;
  onCancelTask: (taskId: string) => void;
  getFullLog: () => string;
  deleteVm: React.ComponentProps<typeof VMPageModals>['deleteVm'];
}

export const VMWorkspace: React.FC<VMWorkspaceProps> = ({
  isLogResizing,
  queueUiState,
  queueOperationText,
  queueIsProcessing,
  hasPending,
  queueStats,
  processQueue,
  cancelProcessing,
  panelOpen,
  setPanelOpen,
  proxmoxTargets,
  selectedTargetId,
  targetsLoading,
  sshConfigured,
  sshConnected,
  sshStatusCode,
  onTargetChange,
  onTargetsRefresh,
  workspaceLayoutRef,
  workspaceRef,
  workspaceGridTemplateColumns,
  isWorkspaceResizing,
  startWorkspaceResize,
  proxmoxVms,
  proxmoxLoading,
  proxmoxConnected,
  proxmoxNode,
  refreshVMs,
  onRecreateVm,
  queueItems,
  isStartActionRunning,
  canStartAll,
  startingQueueItemId,
  storageOptions,
  projectOptions,
  resourcePresets,
  onAddVm,
  onAddDelete,
  onClearQueue,
  onStartAll,
  onStartOne,
  onRemoveQueueItem,
  onUpdateQueueItem,
  startLogResize,
  logHeight,
  logTasks,
  onClearLog,
  onCancelTask,
  getFullLog,
  deleteVm,
}) => {
  return (
    <div className={cx(`vm-generator ${isLogResizing ? 'vm-generator--resizing' : ''}`)}>
      <VMStatusBar
        uiState={queueUiState}
        operationText={queueOperationText}
        isProcessing={queueIsProcessing}
        hasPending={hasPending}
        queueTotal={queueStats.total}
        pendingCount={queueStats.pending}
        activeCount={queueStats.active}
        doneCount={queueStats.done}
        errorCount={queueStats.error}
        onStart={processQueue}
        onStop={cancelProcessing}
        onOpenSettings={() => {
          setPanelOpen('settings');
        }}
        activeTopPanel={panelOpen}
      />

      <VmTargetStrip
        targets={proxmoxTargets}
        selectedTargetId={selectedTargetId}
        loading={targetsLoading}
        sshConfigured={sshConfigured}
        sshConnected={sshConnected}
        sshStatusCode={sshStatusCode}
        onChange={onTargetChange}
        onRefresh={onTargetsRefresh}
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
            vms={proxmoxVms}
            loading={proxmoxLoading}
            connected={proxmoxConnected}
            node={proxmoxNode}
            refreshVMs={refreshVMs}
            onRecreate={onRecreateVm}
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
              queue={queueItems}
              isProcessing={queueIsProcessing}
              isStartActionRunning={isStartActionRunning}
              canStartAll={canStartAll}
              startingItemId={startingQueueItemId}
              storageOptions={storageOptions}
              projectOptions={projectOptions}
              resourcePresets={resourcePresets}
              onAdd={onAddVm}
              onAddDelete={onAddDelete}
              onClear={onClearQueue}
              onStartAll={onStartAll}
              onStartOne={onStartOne}
              onRemove={onRemoveQueueItem}
              onUpdate={onUpdateQueueItem}
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
              tasks={logTasks}
              onClear={onClearLog}
              onCancelTask={onCancelTask}
              getFullLog={getFullLog}
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
