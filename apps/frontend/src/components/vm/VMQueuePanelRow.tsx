import { FileTextOutlined } from '@ant-design/icons';
import { Button, Progress, Select, Typography } from 'antd';
import type React from 'react';
import type { Playbook } from '../../entities/vm/api/playbookFacade';
import type { UnattendProfile } from '../../entities/vm/api/unattendProfileFacade';
import type { VMQueueItem, VMStorageOption } from '../../types';
import {
  buildStorageUsage,
  formatMemoryGiB,
  getStatusDisplay,
  toMemoryMb,
} from './queuePanelUtils';
import { VMQueuePanelRowActions } from './VMQueuePanelRowActions';
import { VMQueuePanelRowNameCell } from './VMQueuePanelRowNameCell';
import { VMQueuePanelRowResourcesCell } from './VMQueuePanelRowResourcesCell';

const { Text } = Typography;

type VMProjectId = 'wow_tbc' | 'wow_midnight';

interface QueueResourcePreset {
  label: string;
  cores: number;
  memoryMb: number;
  diskGiB: number;
}

interface VMQueuePanelRowProps {
  item: VMQueueItem;
  isProcessing: boolean;
  isStartActionRunning: boolean;
  startingItemId: string | null;
  storageOptions: VMStorageOption[];
  projectOptionById: Map<VMProjectId, { value: VMProjectId; label: string }>;
  resourcePresets: Record<VMProjectId, QueueResourcePreset>;
  unattendProfileById: Map<string, UnattendProfile>;
  defaultUnattendProfile: UnattendProfile | null;
  playbookList: Playbook[];
  defaultPlaybook: Playbook | null;
  unattendProfilesLoading: boolean;
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<VMQueueItem>) => void;
  onStartOne?: (id: string) => void;
  openCustomEditor: (item: VMQueueItem) => void;
  openUnattendEditor: (item: VMQueueItem) => void;
  className: (classNames: string) => string;
}

export const VMQueuePanelRow: React.FC<VMQueuePanelRowProps> = ({
  item,
  isProcessing,
  isStartActionRunning,
  startingItemId,
  storageOptions,
  projectOptionById,
  resourcePresets,
  unattendProfileById,
  defaultUnattendProfile,
  playbookList,
  defaultPlaybook,
  unattendProfilesLoading,
  onRemove,
  onUpdate,
  onStartOne,
  openCustomEditor,
  openUnattendEditor,
  className,
}) => {
  const action = item.action || 'create';
  const isDeleteAction = action === 'delete';
  const status = getStatusDisplay(item.status);
  const deleteTargetVmId = Number(item.targetVmId ?? item.vmId);
  const hasDeleteTargetVmId = Number.isInteger(deleteTargetVmId) && deleteTargetVmId > 0;
  const editableCreate = !isDeleteAction && (!isProcessing || item.status === 'pending');
  const canRemove = !isProcessing && !isStartActionRunning;
  const canStartItem =
    !isDeleteAction &&
    item.status === 'done' &&
    Number.isInteger(Number(item.vmId)) &&
    Number(item.vmId) > 0 &&
    typeof onStartOne === 'function';
  const isItemStarting = isStartActionRunning && startingItemId === item.id;

  const projectId = item.projectId as VMProjectId;
  const preset = resourcePresets[projectId] || {
    label: projectOptionById.get(projectId)?.label || projectId,
    cores: 2,
    memoryMb: 4096,
    diskGiB: 128,
  };

  const effectiveCores =
    Number.isFinite(Number(item.cores)) && Number(item.cores) > 0
      ? Math.trunc(Number(item.cores))
      : preset.cores;
  const effectiveMemoryMb = toMemoryMb(item.memory) ?? preset.memoryMb;
  const effectiveDiskGiB =
    Number.isFinite(Number(item.diskGiB)) && Number(item.diskGiB) > 0
      ? Math.max(1, Math.trunc(Number(item.diskGiB)))
      : preset.diskGiB;

  const projectSelectValue = item.resourceMode === 'custom' ? 'custom' : projectId;
  const attachedProfile = item.unattendProfileId
    ? unattendProfileById.get(item.unattendProfileId) || defaultUnattendProfile
    : defaultUnattendProfile;
  const hasXmlOverride = Boolean(String(item.unattendXmlOverride || '').trim());

  return (
    <div key={item.id} className={className('vm-queue-item')}>
      <VMQueuePanelRowNameCell
        item={item}
        isDeleteAction={isDeleteAction}
        hasDeleteTargetVmId={hasDeleteTargetVmId}
        deleteTargetVmId={deleteTargetVmId}
        editableCreate={editableCreate}
        onUpdate={onUpdate}
        className={className}
      />

      <div className={className('vm-queue-item-select vm-queue-item-select--storage')}>
        {isDeleteAction ? (
          <div className={className('vm-queue-item-placeholder')}>-</div>
        ) : (
          <Select
            className={className('vm-queue-storage-select')}
            size="small"
            value={item.storage}
            onChange={(value) => onUpdate(item.id, { storage: value, storageMode: 'manual' })}
            disabled={!editableCreate}
            optionLabelProp="label"
            popupMatchSelectWidth={false}
            listHeight={400}
            placement="bottomLeft"
            dropdownStyle={{
              background: 'var(--boxmox-color-surface-panel)',
              border: '1px solid var(--boxmox-color-border-default)',
              borderRadius: 'var(--radius-md)',
              padding: 4,
            }}
          >
            {storageOptions.map((opt) => {
              const usage = buildStorageUsage(opt);
              const vmCount = typeof opt.vmCount === 'number' ? opt.vmCount : null;

              return (
                <Select.Option key={opt.value} value={opt.value} label={opt.label}>
                  <div className={className('vm-queue-dropdown-option')}>
                    <div className={className('vm-queue-dropdown-option-head')}>
                      <Text strong>{opt.label}</Text>
                      {vmCount !== null ? (
                        <Text
                          type="secondary"
                          className={className('vm-queue-dropdown-option-meta')}
                        >
                          {vmCount} VMs
                        </Text>
                      ) : null}
                    </div>

                    {usage ? (
                      <div className={className('vm-queue-dropdown-option-usage')}>
                        <Progress
                          percent={usage.percent}
                          showInfo={false}
                          size="small"
                          strokeColor="var(--boxmox-color-brand-primary)"
                          trailColor="var(--boxmox-color-surface-hover)"
                        />
                        <Text
                          type="secondary"
                          className={className('vm-queue-dropdown-option-usage-text')}
                        >
                          {usage.label}
                        </Text>
                      </div>
                    ) : opt.details ? (
                      <Text
                        type="secondary"
                        className={className('vm-queue-dropdown-option-usage-text')}
                      >
                        {opt.details}
                      </Text>
                    ) : null}
                  </div>
                </Select.Option>
              );
            })}
          </Select>
        )}
      </div>

      <div className={className('vm-queue-item-select vm-queue-item-select--project')}>
        {isDeleteAction ? (
          <div className={className('vm-queue-item-placeholder')}>-</div>
        ) : (
          <Select
            className={className('vm-queue-project-select')}
            size="small"
            value={projectSelectValue}
            disabled={!editableCreate}
            onChange={(value) => {
              if (value === 'custom') {
                openCustomEditor(item);
                return;
              }

              const selectedProject = value as VMProjectId;
              onUpdate(item.id, {
                projectId: selectedProject,
                resourceMode: 'project',
                cores: undefined,
                memory: undefined,
                diskGiB: resourcePresets[selectedProject]?.diskGiB,
              });
            }}
            popupMatchSelectWidth={300}
            listHeight={400}
            placement="bottomLeft"
            dropdownStyle={{
              background: 'var(--boxmox-color-surface-panel)',
              border: '1px solid var(--boxmox-color-border-default)',
              borderRadius: 'var(--radius-md)',
              padding: 4,
            }}
            optionLabelProp="label"
          >
            {Array.from(projectOptionById.values()).map((opt) => {
              const p = resourcePresets[opt.value];
              const meta = p
                ? `${p.cores} CPU · ${formatMemoryGiB(p.memoryMb)} · ${p.diskGiB} GB`
                : '';

              return (
                <Select.Option key={opt.value} value={opt.value} label={opt.label}>
                  <div className={className('vm-queue-dropdown-option')}>
                    <div className={className('vm-queue-dropdown-option-head')}>
                      <Text strong>{opt.label}</Text>
                    </div>
                    <Text
                      type="secondary"
                      className={className('vm-queue-dropdown-option-usage-text')}
                    >
                      {meta}
                    </Text>
                  </div>
                </Select.Option>
              );
            })}
            <Select.Option value="custom" label="Custom">
              <div className={className('vm-queue-dropdown-option')}>
                <div className={className('vm-queue-dropdown-option-head')}>
                  <Text strong>Custom Configuration</Text>
                </div>
                <Text type="secondary" className={className('vm-queue-dropdown-option-usage-text')}>
                  Manually configure CPU, RAM, and Disk
                </Text>
              </div>
            </Select.Option>
          </Select>
        )}
      </div>

      <VMQueuePanelRowResourcesCell
        item={item}
        isDeleteAction={isDeleteAction}
        effectiveCores={effectiveCores}
        effectiveMemoryMb={effectiveMemoryMb}
        effectiveDiskGiB={effectiveDiskGiB}
        openCustomEditor={openCustomEditor}
        className={className}
      />

      <div className={className('vm-queue-item-unattend')}>
        {isDeleteAction ? (
          <div className={className('vm-queue-item-placeholder')}>-</div>
        ) : (
          <div className={className('vm-queue-item-cell-compact')}>
            <div className={className('vm-queue-item-cell-info')}>
              <Text
                className={className('vm-queue-item-cell-text')}
                title={attachedProfile?.name || 'Default profile'}
              >
                {attachedProfile?.name || 'Default'}
              </Text>
              {hasXmlOverride && (
                <div className={className('vm-queue-dot-indicator')} title="XML Override Active" />
              )}
            </div>
            <Button
              type="text"
              size="small"
              icon={<FileTextOutlined />}
              className={className('vm-queue-item-cell-action')}
              onClick={() => openUnattendEditor(item)}
              disabled={!editableCreate}
              loading={unattendProfilesLoading}
              title="Configure Unattend"
            />
          </div>
        )}
      </div>

      <div className={className('vm-queue-item-playbook')}>
        {isDeleteAction ? (
          <div className={className('vm-queue-item-placeholder')}>-</div>
        ) : (
          <Select
            className={className('vm-queue-playbook-select')}
            value={item.playbookId || (defaultPlaybook?.id ?? 'none')}
            onChange={(value) =>
              onUpdate(item.id, { playbookId: value === 'none' ? undefined : value })
            }
            disabled={!editableCreate}
            popupMatchSelectWidth={false}
            size="small"
            dropdownStyle={{
              background: 'var(--boxmox-color-surface-panel)',
              border: '1px solid var(--boxmox-color-border-default)',
              borderRadius: 'var(--radius-md)',
              padding: 4,
            }}
          >
            <Select.Option value="none">None</Select.Option>
            {playbookList.map((p) => (
              <Select.Option key={p.id} value={p.id}>
                {p.is_default ? `* ${p.name}` : p.name}
              </Select.Option>
            ))}
          </Select>
        )}
      </div>

      <VMQueuePanelRowActions
        canStartItem={canStartItem}
        isItemStarting={isItemStarting}
        isProcessing={isProcessing}
        isStartActionRunning={isStartActionRunning}
        vmId={item.vmId}
        itemId={item.id}
        statusText={status.text}
        statusTone={status.tone}
        canRemove={canRemove}
        onStartOne={onStartOne}
        onRemove={onRemove}
        className={className}
      />
    </div>
  );
};
