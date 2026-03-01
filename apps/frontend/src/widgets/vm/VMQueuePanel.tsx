import type React from 'react';
import {
  useVMQueuePanelBridgeValue,
  VMQueueContextProvider,
} from '../../features/vm-queue/model/VMQueueContext';
import { bindCssModuleCx } from '../../shared/lib/classNames';
import { useVmWorkspaceQueueItems } from '../vm-workspace/model/useVmWorkspaceStore';
import { useVMQueuePanelState } from './useVMQueuePanelState';
import { VMQueueColumnsHeader } from './VMQueueColumnsHeader';
import { VMQueueCustomResourcesModal } from './VMQueueCustomResourcesModal';
import coreStyles from './VMQueuePanelCore.module.css';
import { VMQueuePanelHeader } from './VMQueuePanelHeader';
import modalStyles from './VMQueuePanelModal.module.css';
import { VMQueuePanelRow } from './VMQueuePanelRow';
import { VMQueueUnattendModal } from './VMQueueUnattendModal';

const styles = { ...coreStyles, ...modalStyles };

const cx = bindCssModuleCx(styles);

export const VMQueuePanel: React.FC = () => {
  const queue = useVmWorkspaceQueueItems();
  const bridge = useVMQueuePanelBridgeValue();

  const isProcessing = bridge.isProcessing;
  const isStartActionRunning = bridge.isStartActionRunning;
  const startingItemId = bridge.startingItemId;
  const storageOptions = bridge.storageOptions;
  const projectOptions = bridge.projectOptions;
  const resourcePresets = bridge.resourcePresets;
  const onAdd = bridge.onAdd;
  const onAddDelete = bridge.onAddDelete;
  const onClear = bridge.onClear;
  const onStartAll = bridge.onStartAll;
  const onStartOne = bridge.onStartOne;
  const onRemove = bridge.onRemove;
  const onUpdate = bridge.onUpdate;

  const canStartAllFromQueue = queue.some(
    (item) =>
      (item.action || 'create') === 'create' &&
      item.status === 'done' &&
      Number.isInteger(Number(item.vmId)) &&
      Number(item.vmId) > 0,
  );
  const canStartAll = bridge.canStartAll ?? canStartAllFromQueue;

  const state = useVMQueuePanelState({
    queue,
    projectOptions,
    resourcePresets,
    onUpdate,
  });

  const contextValue = {
    queue,
    isProcessing,
    isStartActionRunning,
    startingItemId,
    storageOptions,
    projectOptionById: state.projectOptionById,
    resourcePresets,
    unattendProfileById: state.unattendProfileById,
    defaultUnattendProfile: state.defaultUnattendProfile,
    playbookList: state.playbookList,
    defaultPlaybook: state.defaultPlaybook,
    unattendProfilesLoading: state.unattendProfilesLoading,
    onRemove,
    onUpdate,
    onStartOne,
    openCustomEditor: state.openCustomEditor,
    openUnattendEditor: state.openUnattendEditor,
    className: cx,
  } as const;

  return (
    <VMQueueContextProvider value={contextValue}>
      <div className={`${cx('vm-queue-panel')} vm-queue-panel`}>
        <VMQueuePanelHeader
          className={cx}
          isProcessing={isProcessing}
          isStartActionRunning={isStartActionRunning}
          canStartAll={canStartAll}
          onStartAll={onStartAll}
          onAddDelete={onAddDelete}
          onAdd={onAdd}
          onClear={onClear}
        />

        <div className={`${cx('vm-queue-panel-list')} vm-queue-panel-list`}>
          {queue.length === 0 ? (
            <div className={cx('vm-queue-panel-empty')}>
              Queue is empty. Press "+ VM" or Ctrl+N to create a VM.
            </div>
          ) : (
            <>
              <VMQueueColumnsHeader className={cx} />
              {queue.map((item) => (
                <VMQueuePanelRow key={item.id} item={item} />
              ))}
            </>
          )}
        </div>

        <VMQueueCustomResourcesModal
          open={Boolean(state.customEditor)}
          customEditor={state.customEditor}
          projectOptions={projectOptions}
          className={cx}
          onCancel={() => state.setCustomEditor(null)}
          onApply={state.applyCustomEditor}
          onChange={(next) => state.setCustomEditor(next)}
        />

        <VMQueueUnattendModal
          open={Boolean(state.unattendEditor)}
          className={cx}
          unattendEditor={state.unattendEditor}
          unattendProfiles={state.unattendProfiles}
          unattendProfilesLoading={state.unattendProfilesLoading}
          unattendEditorError={state.unattendEditorError}
          activeUnattendPreview={state.activeUnattendPreview}
          onCancel={() => {
            state.setUnattendEditor(null);
            state.setUnattendEditorError(null);
          }}
          onApply={state.applyUnattendEditor}
          onProfileChange={(value) =>
            state.setUnattendEditor((prev) => (prev ? { ...prev, profileId: value } : prev))
          }
          onImportBeforeUpload={state.handleQueueXmlImport}
          onUseProfileTemplate={() =>
            state.setUnattendEditor((prev) => (prev ? { ...prev, xmlOverride: '' } : prev))
          }
          onExportTemplate={state.exportUnattendTemplate}
          onExportFinal={state.exportUnattendFinal}
        />
      </div>
    </VMQueueContextProvider>
  );
};
