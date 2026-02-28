import type React from 'react';
import { useRefreshOnVmMutationEvents } from '../../entities/vm/api/useRefreshOnVmMutationEvents';
import { useVMKeyboardShortcuts } from '../../features/vm-management/model/useVMKeyboardShortcuts';
import { VMListContainer, VMOperationLog, VMQueuePanel, VMStatusBar } from '../../widgets/vm';
import { VMWorkspace } from '../../widgets/vm-workspace';
import { VMPageModals } from '../../widgets/vm-workspace/ui/VMPageModals';
import { VmTargetStrip } from '../../widgets/vm-workspace/ui/VmTargetStrip';
import { useVmsPageViewModel, VM_COMMAND_REFRESH_DEBOUNCE_MS } from './hooks/useVmsPageViewModel';

export const VMsPage: React.FC = () => {
  const bridge = useVmsPageViewModel();

  useRefreshOnVmMutationEvents({
    onMutationTerminalEvent: bridge.handleVmMutationTerminalEvent,
    debounceMs: VM_COMMAND_REFRESH_DEBOUNCE_MS,
  });

  useVMKeyboardShortcuts(bridge.shortcutActions);

  return (
    <VMWorkspace
      renderStatusBar={({ openSettings, panelOpen }) => (
        <VMStatusBar
          uiState={bridge.queue.uiState}
          operationText={bridge.queue.operationText}
          isProcessing={bridge.queue.isProcessing}
          hasPending={bridge.hasPending}
          queueTotal={bridge.queueStats.total}
          pendingCount={bridge.queueStats.pending}
          activeCount={bridge.queueStats.active}
          doneCount={bridge.queueStats.done}
          errorCount={bridge.queueStats.error}
          onStart={bridge.queue.processQueue}
          onStop={bridge.queue.cancelProcessing}
          onOpenSettings={openSettings}
          activeTopPanel={panelOpen}
        />
      )}
      targetStrip={
        <VmTargetStrip
          sshConfigured={bridge.proxmoxStatus.sshConfigured}
          sshConnected={bridge.proxmoxStatus.sshConnected}
          sshStatusCode={bridge.proxmoxStatus.sshStatusCode}
          onTargetChanged={bridge.refreshAfterTargetChange}
        />
      }
      servicePane={<VMListContainer onRecreate={bridge.handleRecreateVm} />}
      queuePane={
        <VMQueuePanel
          isProcessing={bridge.queue.isProcessing}
          isStartActionRunning={bridge.isStartActionRunning}
          canStartAll={bridge.startableQueueItems.length > 0}
          startingItemId={bridge.startingQueueItemId}
          storageOptions={bridge.storageOptions}
          projectOptions={bridge.projectOptions}
          resourcePresets={bridge.resourcePresets}
          onAdd={bridge.handleAddVM}
          onAddDelete={bridge.deleteVm.handleOpenDeleteVmModal}
          onClear={bridge.queue.clearQueue}
          onStartAll={bridge.handleStartAllReady}
          onStartOne={bridge.handleStartOneReady}
          onRemove={bridge.queue.removeFromQueue}
          onUpdate={bridge.handleQueueUpdate}
        />
      }
      logPane={
        <VMOperationLog
          onClear={bridge.log.clear}
          onCancelTask={bridge.handleCancelTask}
          getFullLog={bridge.log.getFullLog}
        />
      }
      renderModals={({ panelOpen, setPanelOpen }) => (
        <VMPageModals
          deleteVm={bridge.deleteVm}
          storageOptions={bridge.storageOptions}
          panelOpen={panelOpen}
          setPanelOpen={setPanelOpen}
        />
      )}
    />
  );
};
