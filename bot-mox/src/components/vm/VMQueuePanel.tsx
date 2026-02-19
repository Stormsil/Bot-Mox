import { FileTextOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import {
  Button,
  InputNumber,
  Modal,
  message,
  Progress,
  Select,
  Space,
  Typography,
  Upload,
} from 'antd';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { listPlaybooks, type Playbook } from '../../entities/vm/api/playbookFacade';
import {
  DEFAULT_PROFILE_CONFIG,
  listUnattendProfiles,
  migrateProfileConfig,
  type UnattendProfile,
} from '../../entities/vm/api/unattendProfileFacade';
import type { VMQueueItem, VMQueueItemStatus, VMStorageOption } from '../../types';
import {
  buildFinalUnattendXml,
  DEFAULT_UNATTEND_XML_TEMPLATE,
  triggerXmlDownload,
  validateUnattendXml,
} from '../../utils/unattendXml';
import styles from './VMQueuePanel.module.css';

const { Text } = Typography;
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

interface CustomEditorState {
  itemId: string;
  vmName: string;
  baseProject: VMProjectId;
  cores: number;
  memoryGiB: number;
  diskGiB: number;
}

interface UnattendEditorState {
  itemId: string;
  profileId?: string;
  xmlOverride: string;
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

function toMemoryMb(memory?: number): number | null {
  if (!Number.isFinite(memory)) return null;
  const value = Math.max(0, Math.trunc(Number(memory)));
  if (value <= 0) return null;
  if (value <= 64) return value * 1024;
  return value;
}

function formatMemoryGiB(memoryMb: number): string {
  const gib = memoryMb / 1024;
  if (Number.isInteger(gib)) {
    return `${gib} GiB`;
  }
  return `${gib.toFixed(1)} GiB`;
}

function formatGb(bytes: number): string {
  const gb = bytes / 1_000_000_000;
  if (!Number.isFinite(gb) || gb < 0) return '0.00';
  return gb.toFixed(2);
}

function buildStorageUsage(opt: VMStorageOption): null | { percent: number; label: string } {
  const used = Number(opt.usedBytes);
  const total = Number(opt.totalBytes);
  if (!Number.isFinite(used) || used < 0 || !Number.isFinite(total) || total <= 0) return null;

  const percent = (used / total) * 100;
  const safePercent = Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0;
  return {
    percent: safePercent,
    label: `${safePercent.toFixed(2)}% (${formatGb(used)} GB of ${formatGb(total)} GB)`,
  };
}

function getStatusDisplay(status: VMQueueItemStatus): {
  text: string;
  tone: 'idle' | 'running' | 'ok' | 'error';
} {
  switch (status) {
    case 'done':
      return { text: 'Done', tone: 'ok' };
    case 'cloned':
      return { text: 'Queued', tone: 'idle' };
    case 'cloning':
      return { text: 'Running', tone: 'running' };
    case 'configuring':
      return { text: 'Running', tone: 'running' };
    case 'provisioning':
      return { text: 'Provisioning', tone: 'running' };
    case 'deleting':
      return { text: 'Deleting', tone: 'running' };
    case 'error':
      return { text: 'Error', tone: 'error' };
    default:
      return { text: 'Queued', tone: 'idle' };
  }
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
  const [customEditor, setCustomEditor] = useState<CustomEditorState | null>(null);
  const [unattendEditor, setUnattendEditor] = useState<UnattendEditorState | null>(null);
  const [unattendProfiles, setUnattendProfiles] = useState<UnattendProfile[]>([]);
  const [unattendProfilesLoading, setUnattendProfilesLoading] = useState(true);
  const [unattendEditorError, setUnattendEditorError] = useState<string | null>(null);
  const [playbookList, setPlaybookList] = useState<Playbook[]>([]);

  useEffect(() => {
    let active = true;

    void listUnattendProfiles()
      .then((envelope) => {
        if (!active) return;
        setUnattendProfiles(envelope.data || []);
      })
      .catch(() => {
        if (!active) return;
        setUnattendProfiles([]);
      })
      .finally(() => {
        if (!active) return;
        setUnattendProfilesLoading(false);
      });

    void listPlaybooks()
      .then((envelope) => {
        if (!active) return;
        setPlaybookList(envelope.data || []);
      })
      .catch(() => {
        if (!active) return;
        setPlaybookList([]);
      });

    return () => {
      active = false;
    };
  }, []);

  const projectOptionById = useMemo(
    () => new Map(projectOptions.map((option) => [option.value, option] as const)),
    [projectOptions],
  );

  const unattendProfileById = useMemo(
    () => new Map(unattendProfiles.map((profile) => [profile.id, profile] as const)),
    [unattendProfiles],
  );

  const defaultUnattendProfile = useMemo(
    () => unattendProfiles.find((profile) => profile.is_default) || unattendProfiles[0] || null,
    [unattendProfiles],
  );

  const defaultPlaybook = useMemo(
    () => playbookList.find((p) => p.is_default) || null,
    [playbookList],
  );

  const openCustomEditor = (item: VMQueueItem) => {
    const baseProject = item.projectId as VMProjectId;
    const preset = resourcePresets[baseProject] || {
      label: baseProject,
      cores: 2,
      memoryMb: 4096,
      diskGiB: 128,
    };

    const currentMemoryMb = toMemoryMb(item.memory) ?? preset.memoryMb;
    const currentDiskGiB =
      Number.isFinite(Number(item.diskGiB)) && Number(item.diskGiB) > 0
        ? Math.max(1, Math.trunc(Number(item.diskGiB)))
        : preset.diskGiB;

    setCustomEditor({
      itemId: item.id,
      vmName: item.name,
      baseProject,
      cores: Math.max(1, Math.trunc(Number(item.cores) || preset.cores)),
      memoryGiB: Math.max(1, Math.round(currentMemoryMb / 1024)),
      diskGiB: Math.max(32, Math.trunc(currentDiskGiB)),
    });
  };

  const applyCustomEditor = () => {
    if (!customEditor) return;

    onUpdate(customEditor.itemId, {
      projectId: customEditor.baseProject,
      resourceMode: 'custom',
      cores: Math.max(1, Math.trunc(customEditor.cores)),
      memory: Math.max(1024, Math.trunc(customEditor.memoryGiB) * 1024),
      diskGiB: Math.max(32, Math.trunc(customEditor.diskGiB)),
    });

    setCustomEditor(null);
  };

  const openUnattendEditor = (item: VMQueueItem) => {
    const preferredProfile = item.unattendProfileId
      ? unattendProfileById.get(item.unattendProfileId)
      : defaultUnattendProfile;

    setUnattendEditor({
      itemId: item.id,
      profileId: item.unattendProfileId || preferredProfile?.id,
      xmlOverride: String(item.unattendXmlOverride || ''),
    });
    setUnattendEditorError(null);
  };

  const activeUnattendPreview = useMemo(() => {
    if (!unattendEditor) return null;
    const queueItem = queue.find((item) => item.id === unattendEditor.itemId);
    if (!queueItem) return null;

    const profile = unattendEditor.profileId
      ? unattendProfileById.get(unattendEditor.profileId) || defaultUnattendProfile
      : defaultUnattendProfile;
    const profileConfig = migrateProfileConfig(profile?.config || DEFAULT_PROFILE_CONFIG);

    const templateXml =
      String(unattendEditor.xmlOverride || '').trim() ||
      String(profileConfig.xmlTemplate || DEFAULT_UNATTEND_XML_TEMPLATE).trim() ||
      DEFAULT_UNATTEND_XML_TEMPLATE;

    const finalXml = buildFinalUnattendXml(templateXml, profileConfig);

    return {
      queueItem,
      profile,
      templateXml,
      finalXml,
    };
  }, [unattendEditor, queue, unattendProfileById, defaultUnattendProfile]);

  const handleQueueXmlImport: UploadProps['beforeUpload'] = async (file) => {
    if (!unattendEditor) return false;

    try {
      const importedXml = await file.text();
      const validation = validateUnattendXml(importedXml);
      if (!validation.valid) {
        setUnattendEditorError(validation.error);
        message.error('Invalid XML file');
        return false;
      }

      setUnattendEditor((prev) => (prev ? { ...prev, xmlOverride: importedXml } : prev));
      setUnattendEditorError(null);
      message.success('Queue XML override imported');
    } catch {
      message.error('Failed to import XML override');
    }

    return false;
  };

  const applyUnattendEditor = () => {
    if (!unattendEditor) return;

    onUpdate(unattendEditor.itemId, {
      unattendProfileId: unattendEditor.profileId,
      unattendXmlOverride: String(unattendEditor.xmlOverride || '').trim() || undefined,
    });

    setUnattendEditor(null);
    setUnattendEditorError(null);
  };

  const exportUnattendTemplate = () => {
    if (!activeUnattendPreview) return;
    const vmName = activeUnattendPreview.queueItem.name || 'vm';
    triggerXmlDownload(`${vmName}-template.xml`, activeUnattendPreview.templateXml);
  };

  const exportUnattendFinal = () => {
    if (!activeUnattendPreview) return;
    const vmName = activeUnattendPreview.queueItem.name || 'vm';
    triggerXmlDownload(`${vmName}-final.xml`, activeUnattendPreview.finalXml);
  };

  return (
    <div className={`${cx('vm-queue-panel')} vm-queue-panel`}>
      <div className={cx('vm-queue-panel-header')}>
        <div className={cx('vm-queue-panel-header-main')}>
          <span className={cx('vm-queue-panel-header-title')}>VM Queue</span>
        </div>
        <div className={cx('vm-queue-panel-header-actions')}>
          <button
            type="button"
            className={cx('vm-queue-panel-start-all')}
            onClick={onStartAll}
            disabled={isProcessing || isStartActionRunning || !canStartAll || !onStartAll}
          >
            {isStartActionRunning ? 'Starting...' : 'Start all'}
          </button>
          <button type="button" onClick={onAddDelete} disabled={isProcessing || !onAddDelete}>Delete VM</button>
          <button type="button" onClick={onAdd} disabled={isProcessing}>+ VM</button>
          <button type="button" onClick={onClear} disabled={isProcessing || isStartActionRunning}>Clear</button>
        </div>
      </div>

      <div className={`${cx('vm-queue-panel-list')} vm-queue-panel-list`}>
        {queue.length === 0 ? (
          <div className={cx('vm-queue-panel-empty')}>
            Queue is empty. Press "+ VM" or Ctrl+N to create a VM.
          </div>
        ) : (
          <>
            <div className={cx('vm-queue-columns')}>
              <span className={cx('vm-queue-columns-name')}>VM</span>
              <span>STORAGE</span>
              <span>PROJECT</span>
              <span>RESOURCES</span>
              <span className={cx('vm-queue-columns-unattend')}>UNATTEND</span>
              <span className={cx('vm-queue-columns-playbook')}>PLAYBOOK</span>
              <span className={cx('vm-queue-columns-status')}>STATE</span>
              <span className={cx('vm-queue-columns-remove')} />
            </div>

            {queue.map((item) => {
              const action = item.action || 'create';
              const isDeleteAction = action === 'delete';
              const status = getStatusDisplay(item.status);
              const deleteTargetVmId = Number(item.targetVmId ?? item.vmId);
              const hasDeleteTargetVmId =
                Number.isInteger(deleteTargetVmId) && deleteTargetVmId > 0;
              const editableCreate =
                !isDeleteAction && (!isProcessing || item.status === 'pending');
              const canRemove = !isProcessing && !isStartActionRunning;
              const canStartItem =
                !isDeleteAction &&
                item.status === 'done' &&
                Number.isInteger(Number(item.vmId)) &&
                Number(item.vmId) > 0 &&
                typeof onStartOne === 'function';
              const isItemStarting = isStartActionRunning && startingItemId === item.id;
              const vmInputValue =
                isDeleteAction && hasDeleteTargetVmId
                  ? `${item.name} [ID ${deleteTargetVmId}]`
                  : item.name;

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
                <div key={item.id} className={cx('vm-queue-item')}>
                  <div className={cx('vm-queue-item-vm')}>
                    <input
                      className={cx('vm-queue-item-input vm-queue-item-input--name')}
                      value={vmInputValue}
                      onChange={(e) => {
                        if (!isDeleteAction) {
                          onUpdate(item.id, { name: e.target.value });
                        }
                      }}
                      disabled={!editableCreate}
                      placeholder="VM name"
                    />
                  </div>

                  <div className={cx('vm-queue-item-select vm-queue-item-select--storage')}>
                    {isDeleteAction ? (
                      <div className={cx('vm-queue-item-placeholder')}>-</div>
                    ) : (
                      <Select
                        className={cx('vm-queue-storage-select')}
                        size="small"
                        value={item.storage}
                        onChange={(value) =>
                          onUpdate(item.id, { storage: value, storageMode: 'manual' })
                        }
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
                              <div className={cx('vm-queue-dropdown-option')}>
                                <div className={cx('vm-queue-dropdown-option-head')}>
                                  <Text strong>{opt.label}</Text>
                                  {vmCount !== null ? (
                                    <Text
                                      type="secondary"
                                      className={cx('vm-queue-dropdown-option-meta')}
                                    >
                                      {vmCount} VMs
                                    </Text>
                                  ) : null}
                                </div>

                                {usage ? (
                                  <div className={cx('vm-queue-dropdown-option-usage')}>
                                    <Progress
                                      percent={usage.percent}
                                      showInfo={false}
                                      size="small"
                                      strokeColor="var(--boxmox-color-brand-primary)"
                                      trailColor="var(--boxmox-color-surface-hover)"
                                    />
                                    <Text
                                      type="secondary"
                                      className={cx('vm-queue-dropdown-option-usage-text')}
                                    >
                                      {usage.label}
                                    </Text>
                                  </div>
                                ) : opt.details ? (
                                  <Text
                                    type="secondary"
                                    className={cx('vm-queue-dropdown-option-usage-text')}
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

                  <div className={cx('vm-queue-item-select vm-queue-item-select--project')}>
                    {isDeleteAction ? (
                      <div className={cx('vm-queue-item-placeholder')}>-</div>
                    ) : (
                      <Select
                        className={cx('vm-queue-project-select')}
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
                        {projectOptions.map((opt) => {
                          const p = resourcePresets[opt.value];
                          const meta = p
                            ? `${p.cores} CPU · ${formatMemoryGiB(p.memoryMb)} · ${p.diskGiB} GB`
                            : '';

                          return (
                            <Select.Option key={opt.value} value={opt.value} label={opt.label}>
                              <div className={cx('vm-queue-dropdown-option')}>
                                <div className={cx('vm-queue-dropdown-option-head')}>
                                  <Text strong>{opt.label}</Text>
                                </div>
                                <Text
                                  type="secondary"
                                  className={cx('vm-queue-dropdown-option-usage-text')}
                                >
                                  {meta}
                                </Text>
                              </div>
                            </Select.Option>
                          );
                        })}
                        <Select.Option value="custom" label="Custom">
                          <div className={cx('vm-queue-dropdown-option')}>
                            <div className={cx('vm-queue-dropdown-option-head')}>
                              <Text strong>Custom Configuration</Text>
                            </div>
                            <Text
                              type="secondary"
                              className={cx('vm-queue-dropdown-option-usage-text')}
                            >
                              Manually configure CPU, RAM, and Disk
                            </Text>
                          </div>
                        </Select.Option>
                      </Select>
                    )}
                  </div>

                  <div className={cx('vm-queue-item-resources')}>
                    {isDeleteAction ? (
                      <div className={cx('vm-queue-item-placeholder')}>Delete operation</div>
                    ) : (
                      <div className={cx('vm-queue-item-resources-compact')}>
                        <div className={cx('vm-queue-item-resources-text')}>
                          {effectiveCores} CPU · {formatMemoryGiB(effectiveMemoryMb)} ·{' '}
                          {effectiveDiskGiB} GB
                        </div>
                        {item.resourceMode === 'custom' && (
                          <Button
                            type="text"
                            size="small"
                            className={cx('vm-queue-item-resource-edit')}
                            style={{
                              height: 20,
                              paddingInline: 6,
                              fontSize: 10,
                              color: 'var(--boxmox-color-brand-primary)',
                            }}
                            onClick={() => openCustomEditor(item)}
                            title="Edit Custom Resources"
                          >
                            Edit
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className={cx('vm-queue-item-unattend')}>
                    {isDeleteAction ? (
                      <div className={cx('vm-queue-item-placeholder')}>-</div>
                    ) : (
                      <div className={cx('vm-queue-item-cell-compact')}>
                        <div className={cx('vm-queue-item-cell-info')}>
                          <Text
                            className={cx('vm-queue-item-cell-text')}
                            title={attachedProfile?.name || 'Default profile'}
                          >
                            {attachedProfile?.name || 'Default'}
                          </Text>
                          {hasXmlOverride && (
                            <div
                              className={cx('vm-queue-dot-indicator')}
                              title="XML Override Active"
                            />
                          )}
                        </div>
                        <Button
                          type="text"
                          size="small"
                          icon={<FileTextOutlined />}
                          className={cx('vm-queue-item-cell-action')}
                          onClick={() => openUnattendEditor(item)}
                          disabled={!editableCreate}
                          loading={unattendProfilesLoading}
                          title="Configure Unattend"
                        />
                      </div>
                    )}
                  </div>

                  <div className={cx('vm-queue-item-playbook')}>
                    {isDeleteAction ? (
                      <div className={cx('vm-queue-item-placeholder')}>-</div>
                    ) : (
                      <Select
                        className={cx('vm-queue-playbook-select')}
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

                  {canStartItem ? (
                    <button
                      type="button"
                      className={cx('vm-queue-item-start')}
                      onClick={() => onStartOne?.(item.id)}
                      disabled={isProcessing || isStartActionRunning}
                      title={item.vmId ? `Start VM ${item.vmId}` : 'Start VM'}
                    >
                      {isItemStarting ? 'STARTING' : 'START'}
                    </button>
                  ) : (
                    <span
                      className={cx('vm-queue-item-status', `vm-queue-item-status--${status.tone}`)}
                    >
                      {status.text.toUpperCase()}
                    </span>
                  )}

                  <button
                    type="button"
                    className={cx('vm-queue-item-remove')}
                    onClick={() => onRemove(item.id)}
                    disabled={!canRemove}
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </>
        )}
      </div>

      <Modal
        title="Custom VM Resources"
        open={Boolean(customEditor)}
        onCancel={() => setCustomEditor(null)}
        onOk={applyCustomEditor}
        okText="Apply"
        destroyOnHidden
      >
        {customEditor ? (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <div className={cx('vm-queue-modal-field')}>
              <div className={cx('vm-queue-modal-label')}>VM</div>
              <Text>{customEditor.vmName}</Text>
            </div>

            <div className={cx('vm-queue-modal-field')}>
              <label htmlFor="vm-queue-custom-base-project">Base Project</label>
              <Select
                id="vm-queue-custom-base-project"
                value={customEditor.baseProject}
                options={projectOptions}
                onChange={(value) =>
                  setCustomEditor((prev) => (prev ? { ...prev, baseProject: value } : prev))
                }
              />
            </div>

            <div className={cx('vm-queue-modal-grid')}>
              <div className={cx('vm-queue-modal-field')}>
                <label htmlFor="vm-queue-custom-cpu-cores">CPU Cores</label>
                <InputNumber
                  id="vm-queue-custom-cpu-cores"
                  value={customEditor.cores}
                  min={1}
                  max={64}
                  step={1}
                  style={{ width: '100%' }}
                  onChange={(value) =>
                    setCustomEditor((prev) =>
                      prev ? { ...prev, cores: Number(value) || 1 } : prev,
                    )
                  }
                />
              </div>

              <div className={cx('vm-queue-modal-field')}>
                <label htmlFor="vm-queue-custom-ram-gib">RAM (GiB)</label>
                <InputNumber
                  id="vm-queue-custom-ram-gib"
                  value={customEditor.memoryGiB}
                  min={1}
                  max={512}
                  step={1}
                  style={{ width: '100%' }}
                  onChange={(value) =>
                    setCustomEditor((prev) =>
                      prev ? { ...prev, memoryGiB: Number(value) || 1 } : prev,
                    )
                  }
                />
              </div>

              <div className={cx('vm-queue-modal-field')}>
                <label htmlFor="vm-queue-custom-disk-gib">Disk (GiB)</label>
                <InputNumber
                  id="vm-queue-custom-disk-gib"
                  value={customEditor.diskGiB}
                  min={32}
                  max={4096}
                  step={1}
                  style={{ width: '100%' }}
                  onChange={(value) =>
                    setCustomEditor((prev) =>
                      prev ? { ...prev, diskGiB: Number(value) || 32 } : prev,
                    )
                  }
                />
              </div>
            </div>
          </Space>
        ) : null}
      </Modal>

      <Modal
        title="Queue VM Unattend XML"
        open={Boolean(unattendEditor)}
        onCancel={() => {
          setUnattendEditor(null);
          setUnattendEditorError(null);
        }}
        onOk={applyUnattendEditor}
        okText="Apply"
        destroyOnHidden
        width={820}
      >
        {unattendEditor ? (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <div className={cx('vm-queue-modal-field')}>
              <label htmlFor="vm-queue-unattend-profile">Profile</label>
              <Select
                id="vm-queue-unattend-profile"
                placeholder="Select profile"
                value={unattendEditor.profileId}
                onChange={(value) =>
                  setUnattendEditor((prev) => (prev ? { ...prev, profileId: value } : prev))
                }
                options={unattendProfiles.map((profile) => ({
                  value: profile.id,
                  label: profile.is_default ? `${profile.name} (default)` : profile.name,
                }))}
                allowClear
                loading={unattendProfilesLoading}
              />
            </div>

            <Space wrap>
              <Upload
                beforeUpload={handleQueueXmlImport}
                showUploadList={false}
                accept=".xml,text/xml,application/xml"
              >
                <Button size="small">Import VM XML Override</Button>
              </Upload>
              <Button
                size="small"
                onClick={() =>
                  setUnattendEditor((prev) => (prev ? { ...prev, xmlOverride: '' } : prev))
                }
              >
                Use Profile Template
              </Button>
              <Button size="small" onClick={exportUnattendTemplate}>
                Export Template
              </Button>
              <Button type="primary" size="small" onClick={exportUnattendFinal}>
                Export Final XML
              </Button>
            </Space>

            {unattendEditorError ? (
              <div className={cx('vm-queue-unattend-error')}>{unattendEditorError}</div>
            ) : null}

            <div className={cx('vm-queue-modal-field')}>
              <div className={cx('vm-queue-modal-label')}>Current Source</div>
              <Text type="secondary">
                {String(unattendEditor.xmlOverride || '').trim()
                  ? 'Per-VM XML override'
                  : `Profile template${activeUnattendPreview?.profile ? `: ${activeUnattendPreview.profile.name}` : ''}`}
              </Text>
            </div>

            <div className={cx('vm-queue-modal-field')}>
              <label htmlFor="vm-queue-final-xml-preview">Final XML Preview</label>
              <textarea
                id="vm-queue-final-xml-preview"
                className={cx('vm-queue-unattend-preview')}
                value={activeUnattendPreview?.finalXml || ''}
                readOnly
              />
            </div>
          </Space>
        ) : null}
      </Modal>
    </div>
  );
};
