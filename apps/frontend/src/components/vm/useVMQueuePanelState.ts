import type { UploadProps } from 'antd';
import { message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { listPlaybooks, type Playbook } from '../../entities/vm/api/playbookFacade';
import {
  DEFAULT_PROFILE_CONFIG,
  listUnattendProfiles,
  migrateProfileConfig,
  type UnattendProfile,
} from '../../entities/vm/api/unattendProfileFacade';
import type { VMQueueItem } from '../../types';
import {
  buildFinalUnattendXml,
  DEFAULT_UNATTEND_XML_TEMPLATE,
  triggerXmlDownload,
  validateUnattendXml,
} from '../../utils/unattendXml';
import { toMemoryMb } from './queuePanelUtils';
import type { CustomEditorState } from './VMQueueCustomResourcesModal';

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

interface UseVmQueuePanelStateParams {
  queue: VMQueueItem[];
  projectOptions: Array<{ value: VMProjectId; label: string }>;
  resourcePresets: Record<VMProjectId, QueueResourcePreset>;
  onUpdate: (id: string, updates: Partial<VMQueueItem>) => void;
}

export function useVMQueuePanelState({
  queue,
  projectOptions,
  resourcePresets,
  onUpdate,
}: UseVmQueuePanelStateParams) {
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
    () => playbookList.find((playbook) => playbook.is_default) || null,
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

  return {
    customEditor,
    unattendEditor,
    unattendProfiles,
    unattendProfilesLoading,
    unattendEditorError,
    playbookList,
    projectOptionById,
    unattendProfileById,
    defaultUnattendProfile,
    defaultPlaybook,
    activeUnattendPreview,
    openCustomEditor,
    applyCustomEditor,
    openUnattendEditor,
    handleQueueXmlImport,
    applyUnattendEditor,
    exportUnattendTemplate,
    exportUnattendFinal,
    setCustomEditor,
    setUnattendEditor,
    setUnattendEditorError,
  };
}
