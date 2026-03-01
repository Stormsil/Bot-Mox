import type React from 'react';
import { useRefreshOnVmMutationEvents } from '../../entities/vm/api/useRefreshOnVmMutationEvents';
import { useVMKeyboardShortcuts } from '../../features/vm-management/model/useVMKeyboardShortcuts';
import { VMListContainer, VMOperationLog, VMQueuePanel, VMStatusBar } from '../../widgets/vm';
import { VMWorkspace } from '../../widgets/vm-workspace';
import { VMPageModals } from '../../widgets/vm-workspace/ui/VMPageModals';
import { VmTargetStrip } from '../../widgets/vm-workspace/ui/VmTargetStrip';
import {
  useVmsPageViewModel,
  useVmWorkspaceController,
  VM_COMMAND_REFRESH_DEBOUNCE_MS,
} from './hooks/useVmsPageViewModel';

export const VMsPage: React.FC = () => {
  const controller = useVmWorkspaceController();
  const bridge = useVmsPageViewModel({
    shortcutActions: controller.shortcutActions,
    onMutationTerminalEvent: controller.handleVmMutationTerminalEvent,
  });

  useRefreshOnVmMutationEvents({
    onMutationTerminalEvent: bridge.onMutationTerminalEvent,
    debounceMs: VM_COMMAND_REFRESH_DEBOUNCE_MS,
  });

  useVMKeyboardShortcuts(bridge.shortcutActions);

  return (
    <VMWorkspace
      renderStatusBar={({ openSettings, panelOpen }) => (
        <VMStatusBar
          uiState={controller.queue.uiState}
          operationText={controller.queue.operationText}
          isProcessing={controller.queue.isProcessing}
          hasPending={controller.hasPending}
          queueTotal={controller.queueStats.total}
          pendingCount={controller.queueStats.pending}
          activeCount={controller.queueStats.active}
          doneCount={controller.queueStats.done}
          errorCount={controller.queueStats.error}
          onStart={controller.queue.processQueue}
          onStop={controller.queue.cancelProcessing}
          onOpenSettings={openSettings}
          activeTopPanel={panelOpen}
        />
      )}
      targetStrip={
        <VmTargetStrip
          sshConfigured={controller.proxmoxStatus.sshConfigured}
          sshConnected={controller.proxmoxStatus.sshConnected}
          sshStatusCode={controller.proxmoxStatus.sshStatusCode}
          onTargetChanged={controller.refreshAfterTargetChange}
        />
      }
      servicePane={<VMListContainer onRecreate={controller.handleRecreateVm} />}
      queuePane={
        <VMQueuePanel
          isProcessing={controller.queue.isProcessing}
          isStartActionRunning={controller.isStartActionRunning}
          canStartAll={controller.startableQueueItems.length > 0}
          startingItemId={controller.startingQueueItemId}
          storageOptions={controller.storageOptions}
          projectOptions={controller.projectOptions}
          resourcePresets={controller.resourcePresets}
          onAdd={controller.handleAddVM}
          onAddDelete={controller.deleteVm.handleOpenDeleteVmModal}
          onClear={controller.queue.clearQueue}
          onStartAll={controller.handleStartAllReady}
          onStartOne={controller.handleStartOneReady}
          onRemove={controller.queue.removeFromQueue}
          onUpdate={controller.handleQueueUpdate}
        />
      }
      logPane={<VMOperationLog />}
      renderModals={({ panelOpen, setPanelOpen }) => (
        <VMPageModals
          deleteVm={controller.deleteVm}
          storageOptions={controller.storageOptions}
          panelOpen={panelOpen}
          setPanelOpen={setPanelOpen}
        />
      )}
    />
  );
};
