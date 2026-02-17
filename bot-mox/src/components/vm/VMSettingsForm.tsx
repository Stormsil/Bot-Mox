import React, { useEffect, useRef, useState } from 'react';
import { message, Tabs } from 'antd';
import type { VMGeneratorSettings, VMStorageOption } from '../../types';
import { getVMSettings, updateVMSettings, stripPasswords } from '../../services/vmSettingsService';
import { getVMConfig } from '../../services/vmService';
import { getSelectedProxmoxTargetNode } from '../../services/vmOpsService';
import {
  normalizeTemplateCores,
  normalizeTemplateMemoryMb,
  ProjectResourcesSection,
  SettingsActions,
  updateSettingsByPath,
} from './settingsForm';
import type { TemplateSyncState, TemplateVmSummary } from './settingsForm';
import { ProxmoxTab } from './settingsForm/ProxmoxTab';
import { UnattendTab } from './settingsForm/UnattendTab';
import { PlaybookTab } from './settingsForm/PlaybookTab';
import styles from './VMSettingsForm.module.css';

const TEMPLATE_VOLUME_KEY = /^(?:ide|sata|scsi|virtio)\d+$/i;
const parseSizeBytesFromVolume = (value: unknown): number | null => {
  const text = String(value ?? '').trim();
  if (!text) return null;

  const match = text.match(/(?:^|,)\s*size=([0-9]+(?:\.[0-9]+)?)([KMGTP])?\s*(?:,|$)/i);
  if (!match) return null;

  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const unit = (match[2] || 'B').toUpperCase();
  const mul =
    unit === 'K'
      ? 1024
      : unit === 'M'
        ? 1024 ** 2
        : unit === 'G'
          ? 1024 ** 3
          : unit === 'T'
            ? 1024 ** 4
            : unit === 'P'
              ? 1024 ** 5
              : 1;

  return Math.round(amount * mul);
};

const buildTemplateSummary = (params: {
  node: string;
  vmId: number;
  config: Record<string, unknown>;
  cores: number | null;
  memoryMb: number | null;
}): TemplateVmSummary => {
  const diskSizes: number[] = [];

  for (const [key, value] of Object.entries(params.config)) {
    if (!TEMPLATE_VOLUME_KEY.test(key)) continue;
    const sizeBytes = parseSizeBytesFromVolume(value);
    if (sizeBytes) diskSizes.push(sizeBytes);
  }

  const diskBytes = diskSizes.length > 0 ? Math.max(...diskSizes) : null;

  let display: string | null = null;
  const vga = params.config['vga'];
  if (typeof vga === 'string' && vga.trim()) {
    display = vga.trim();
  }

  return {
    node: params.node,
    vmId: params.vmId,
    cores: params.cores,
    memoryMb: params.memoryMb,
    diskBytes,
    display,
  };
};

interface VMSettingsFormProps {
  storageOptions?: VMStorageOption[];
}

export const VMSettingsForm: React.FC<VMSettingsFormProps> = ({
  storageOptions = [],
}) => {
  const [settings, setSettings] = useState<VMGeneratorSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templateSyncState, setTemplateSyncState] = useState<TemplateSyncState>('idle');
  const [templateSyncMessage, setTemplateSyncMessage] = useState('');
  const [templateSummary, setTemplateSummary] = useState<TemplateVmSummary | null>(null);
  const lastTemplateSyncKeyRef = useRef<string>('');
  const templateSyncRequestRef = useRef(0);

  useEffect(() => {
    getVMSettings().then((loadedSettings) => {
      setSettings(loadedSettings);
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);
    try {
      await updateVMSettings(stripPasswords(settings));
      message.success('Settings saved');
    } catch {
      message.error('Failed to save settings');
    }
    setSaving(false);
  };

  const handleFieldChange = (path: string, value: unknown) => {
    setSettings((prev) => (prev ? updateSettingsByPath(prev, path, value) : prev));
  };

  useEffect(() => {
    if (!settings) return;

    const vmId = Number(settings.template.vmId);
    if (!Number.isFinite(vmId) || vmId < 1) return;

    const node = getSelectedProxmoxTargetNode() || settings.proxmox.node || 'h1';
    const syncKey = `${node}:${vmId}`;
    if (lastTemplateSyncKeyRef.current === syncKey) return;

    lastTemplateSyncKeyRef.current = syncKey;
    const requestId = ++templateSyncRequestRef.current;

    const timer = window.setTimeout(async () => {
      setTemplateSyncState('loading');
      setTemplateSummary(null);
      setTemplateSyncMessage(`Loading parameters from VM ${vmId}...`);

      try {
        const config = await getVMConfig(vmId, node);
        if (requestId !== templateSyncRequestRef.current) return;

        const loadedCores = normalizeTemplateCores(config.cores);
        const loadedMemory = normalizeTemplateMemoryMb(config.memory);

        setSettings((prev) => {
          if (!prev) return prev;

          const nextCores = loadedCores ?? prev.hardware.cores;
          const nextMemory = loadedMemory ?? prev.hardware.memory;

          return {
            ...prev,
            template: {
              ...prev.template,
              vmId,
            },
            hardware: {
              ...prev.hardware,
              cores: nextCores,
              memory: nextMemory,
            },
          };
        });

        const summary = buildTemplateSummary({
          node,
          vmId,
          config: config as Record<string, unknown>,
          cores: loadedCores,
          memoryMb: loadedMemory,
        });
        setTemplateSummary(summary);

        setTemplateSyncState('ok');
        const meta: string[] = [];
        if (loadedCores !== null) meta.push(`cores=${loadedCores}`);
        if (loadedMemory !== null) meta.push(`memory=${loadedMemory}MB`);
        const suffix = meta.length > 0 ? ` (${meta.join(', ')})` : '';
        setTemplateSyncMessage(`Template VM ${vmId} found on ${node}${suffix}`);
      } catch (error) {
        if (requestId !== templateSyncRequestRef.current) return;
        console.error('Failed to auto-load template VM params:', error);
        setTemplateSummary(null);
        setTemplateSyncState('error');
        setTemplateSyncMessage(`Failed to load parameters from VM ${vmId}`);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [settings]);

  if (loading || !settings) {
    return null;
  }

  const tabItems = [
    {
      key: 'proxmox',
      label: 'Proxmox',
      children: (
        <div>
          <ProxmoxTab
            settings={settings}
            onFieldChange={handleFieldChange}
            syncState={templateSyncState}
            syncMessage={templateSyncMessage}
            templateSummary={templateSummary}
            storageOptions={storageOptions}
          />
          <SettingsActions saving={saving} onSave={handleSave} />
        </div>
      ),
    },
    {
      key: 'resources',
      label: 'Resources',
      children: (
        <div>
          <ProjectResourcesSection settings={settings} onFieldChange={handleFieldChange} />
          <SettingsActions saving={saving} onSave={handleSave} />
        </div>
      ),
    },
    {
      key: 'unattend',
      label: 'Unattend Profile',
      children: <UnattendTab />,
    },
    {
      key: 'playbooks',
      label: 'Playbooks',
      children: <PlaybookTab />,
    },
  ];

  return (
    <div className={styles.root}>
      <Tabs defaultActiveKey="proxmox" items={tabItems} />
    </div>
  );
};
