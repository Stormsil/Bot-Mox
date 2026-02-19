import type { UploadProps } from 'antd';
import { message } from 'antd';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { listPlaybooks, type Playbook } from '../../entities/vm/api/playbookFacade';
import {
  DEFAULT_PROFILE_CONFIG,
  listUnattendProfiles,
  migrateProfileConfig,
  type UnattendProfile,
} from '../../entities/vm/api/unattendProfileFacade';
import type { VMQueueItem, VMStorageOption } from '../../types';
import {
  buildFinalUnattendXml,
  DEFAULT_UNATTEND_XML_TEMPLATE,
  triggerXmlDownload,
  validateUnattendXml,
} from '../../utils/unattendXml';
import { toMemoryMb } from './queuePanelUtils';
import { type CustomEditorState, VMQueueCustomResourcesModal } from './VMQueueCustomResourcesModal';
import styles from './VMQueuePanel.module.css';
import { VMQueuePanelRow } from './VMQueuePanelRow';
import { VMQueueUnattendModal } from './VMQueueUnattendModal';

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
          <button type="button" onClick={onAddDelete} disabled={isProcessing || !onAddDelete}>
            Delete VM
          </button>
          <button type="button" onClick={onAdd} disabled={isProcessing}>
            + VM
          </button>
          <button type="button" onClick={onClear} disabled={isProcessing || isStartActionRunning}>
            Clear
          </button>
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

            {queue.map((item) => (
              <VMQueuePanelRow
                key={item.id}
                item={item}
                isProcessing={isProcessing}
                isStartActionRunning={isStartActionRunning}
                startingItemId={startingItemId}
                storageOptions={storageOptions}
                projectOptionById={projectOptionById}
                resourcePresets={resourcePresets}
                unattendProfileById={unattendProfileById}
                defaultUnattendProfile={defaultUnattendProfile}
                playbookList={playbookList}
                defaultPlaybook={defaultPlaybook}
                unattendProfilesLoading={unattendProfilesLoading}
                onRemove={onRemove}
                onUpdate={onUpdate}
                onStartOne={onStartOne}
                openCustomEditor={openCustomEditor}
                openUnattendEditor={openUnattendEditor}
                className={(names) => cx(names)}
              />
            ))}
          </>
        )}
      </div>

      <VMQueueCustomResourcesModal
        open={Boolean(customEditor)}
        customEditor={customEditor}
        projectOptions={projectOptions}
        className={cx}
        onCancel={() => setCustomEditor(null)}
        onApply={applyCustomEditor}
        onChange={(next) => setCustomEditor(next)}
      />

      <VMQueueUnattendModal
        open={Boolean(unattendEditor)}
        className={cx}
        unattendEditor={unattendEditor}
        unattendProfiles={unattendProfiles}
        unattendProfilesLoading={unattendProfilesLoading}
        unattendEditorError={unattendEditorError}
        activeUnattendPreview={activeUnattendPreview}
        onCancel={() => {
          setUnattendEditor(null);
          setUnattendEditorError(null);
        }}
        onApply={applyUnattendEditor}
        onProfileChange={(value) =>
          setUnattendEditor((prev) => (prev ? { ...prev, profileId: value } : prev))
        }
        onImportBeforeUpload={handleQueueXmlImport}
        onUseProfileTemplate={() =>
          setUnattendEditor((prev) => (prev ? { ...prev, xmlOverride: '' } : prev))
        }
        onExportTemplate={exportUnattendTemplate}
        onExportFinal={exportUnattendFinal}
      />
    </div>
  );
};
