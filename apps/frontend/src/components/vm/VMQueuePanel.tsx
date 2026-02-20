import type React from 'react';
import type { VMQueueItem, VMStorageOption } from '../../types';
import { useVMQueuePanelState } from './useVMQueuePanelState';
import { VMQueueColumnsHeader } from './VMQueueColumnsHeader';
import { VMQueueCustomResourcesModal } from './VMQueueCustomResourcesModal';
import coreStyles from './VMQueuePanelCore.module.css';
import { VMQueuePanelHeader } from './VMQueuePanelHeader';
import modalStyles from './VMQueuePanelModal.module.css';
import { VMQueuePanelRow } from './VMQueuePanelRow';
import { VMQueueUnattendModal } from './VMQueueUnattendModal';

const styles = { ...coreStyles, ...modalStyles };

const cx = (...classNames: Array<string | false | null | undefined>) =>
  classNames
    .flatMap((name) => String(name || '').split(/\s+/))
    .filter(Boolean)
    .map((name) => styles[name] || name)
    .join(' ');

type VMProjectId = 'wow_tbc' | 'wow_midnight';

interface QueueResourcePreset {
  label: string;
  cores: number;
  memoryMb: number;
  diskGiB: number;
}

interface VMQueuePanelProps {
  queue: VMQueueItem[];
  isProcessing: boolean;
  isStartActionRunning?: boolean;
  canStartAll?: boolean;
  startingItemId?: string | null;
  storageOptions: VMStorageOption[];
  projectOptions: Array<{ value: VMProjectId; label: string }>;
  resourcePresets: Record<VMProjectId, QueueResourcePreset>;
  onAdd: () => void;
  onAddDelete?: () => void;
  onClear: () => void;
  onStartAll?: () => void;
  onStartOne?: (id: string) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<VMQueueItem>) => void;
}

export const VMQueuePanel: React.FC<VMQueuePanelProps> = ({
  queue,
  isProcessing,
  isStartActionRunning = false,
  canStartAll = false,
  startingItemId = null,
  storageOptions,
  projectOptions,
  resourcePresets,
  onAdd,
  onAddDelete,
  onClear,
  onStartAll,
  onStartOne,
  onRemove,
  onUpdate,
}) => {
  const state = useVMQueuePanelState({
    queue,
    projectOptions,
    resourcePresets,
    onUpdate,
  });

  return (
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
              <VMQueuePanelRow
                key={item.id}
                item={item}
                isProcessing={isProcessing}
                isStartActionRunning={isStartActionRunning}
                startingItemId={startingItemId}
                storageOptions={storageOptions}
                projectOptionById={state.projectOptionById}
                resourcePresets={resourcePresets}
                unattendProfileById={state.unattendProfileById}
                defaultUnattendProfile={state.defaultUnattendProfile}
                playbookList={state.playbookList}
                defaultPlaybook={state.defaultPlaybook}
                unattendProfilesLoading={state.unattendProfilesLoading}
                onRemove={onRemove}
                onUpdate={onUpdate}
                onStartOne={onStartOne}
                openCustomEditor={state.openCustomEditor}
                openUnattendEditor={state.openUnattendEditor}
                className={cx}
              />
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
  );
};
