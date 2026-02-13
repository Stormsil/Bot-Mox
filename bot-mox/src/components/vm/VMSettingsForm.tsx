import React, { useEffect, useRef, useState } from 'react';
import { message } from 'antd';
import type { VMGeneratorSettings } from '../../types';
import type { SecretBinding, SecretBindingsMap } from '../../types/secrets';
import { getVMSettings, updateVMSettings, stripPasswords } from '../../services/vmSettingsService';
import { loadVmSettingsBindings } from '../../services/secretsService';
import { getVMConfig, testProxmoxConnection, testSSHConnection } from '../../services/vmService';
import {
  normalizeTemplateCores,
  normalizeTemplateMemoryMb,
  ProjectResourcesSection,
  ProxmoxSection,
  ServiceUrlsSection,
  SettingsActions,
  SshSection,
  TemplateStorageSection,
  updateSettingsByPath,
} from './settingsForm';
import type { TemplateSyncState } from './settingsForm';
import './VMSettingsForm.css';

export const VMSettingsForm: React.FC = () => {
  const [settings, setSettings] = useState<VMGeneratorSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [proxmoxOk, setProxmoxOk] = useState<boolean | null>(null);
  const [sshOk, setSshOk] = useState<boolean | null>(null);
  const [testing, setTesting] = useState(false);
  const [templateSyncState, setTemplateSyncState] = useState<TemplateSyncState>('idle');
  const [templateSyncMessage, setTemplateSyncMessage] = useState('');
  const lastTemplateSyncKeyRef = useRef<string>('');
  const templateSyncRequestRef = useRef(0);

  const [secretBindings, setSecretBindings] = useState<SecretBindingsMap>({});

  useEffect(() => {
    Promise.all([
      getVMSettings(),
      loadVmSettingsBindings().catch(() => ({}) as SecretBindingsMap),
    ]).then(([loadedSettings, bindings]) => {
      setSettings(loadedSettings);
      setSecretBindings(bindings);
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

  const handleTestConnections = async () => {
    setTesting(true);
    const [proxmoxStatus, sshStatus] = await Promise.all([
      testProxmoxConnection(),
      testSSHConnection(),
    ]);
    setProxmoxOk(proxmoxStatus);
    setSshOk(sshStatus);
    setTesting(false);
  };

  const handleFieldChange = (path: string, value: unknown) => {
    setSettings((prev) => (prev ? updateSettingsByPath(prev, path, value) : prev));
  };

  const handleSecretBindingChange = (fieldName: string, binding: SecretBinding) => {
    setSecretBindings((prev) => ({ ...prev, [fieldName]: binding }));
  };

  useEffect(() => {
    if (!settings) return;

    const vmId = Number(settings.template.vmId);
    if (!Number.isFinite(vmId) || vmId < 1) return;

    const node = settings.proxmox.node || 'h1';
    const syncKey = `${node}:${vmId}`;
    if (lastTemplateSyncKeyRef.current === syncKey) return;

    lastTemplateSyncKeyRef.current = syncKey;
    const requestId = ++templateSyncRequestRef.current;

    const timer = window.setTimeout(async () => {
      setTemplateSyncState('loading');
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

        if (loadedCores !== null && loadedMemory !== null) {
          setTemplateSyncState('ok');
          setTemplateSyncMessage(`Auto-loaded from VM ${vmId}: cores=${loadedCores}, memory=${loadedMemory}MB`);
        } else if (loadedCores !== null) {
          setTemplateSyncState('ok');
          setTemplateSyncMessage(`Auto-loaded from VM ${vmId}: cores=${loadedCores} (memory kept from current settings)`);
        } else if (loadedMemory !== null) {
          setTemplateSyncState('ok');
          setTemplateSyncMessage(`Auto-loaded from VM ${vmId}: memory=${loadedMemory}MB (cores kept from current settings)`);
        } else {
          setTemplateSyncState('error');
          setTemplateSyncMessage(`VM ${vmId} config does not expose cores/memory. Kept current settings.`);
        }
      } catch (error) {
        if (requestId !== templateSyncRequestRef.current) return;
        console.error('Failed to auto-load template VM params:', error);
        setTemplateSyncState('error');
        setTemplateSyncMessage(`Failed to load parameters from VM ${vmId}`);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [settings]);

  if (loading || !settings) {
    return null;
  }

  return (
    <div className="vm-settings-form">
      <ProxmoxSection
        settings={settings}
        onFieldChange={handleFieldChange}
        secretBindings={secretBindings}
        onSecretBindingChange={handleSecretBindingChange}
      />
      <SshSection
        settings={settings}
        onFieldChange={handleFieldChange}
        secretBindings={secretBindings}
        onSecretBindingChange={handleSecretBindingChange}
      />
      <TemplateStorageSection
        settings={settings}
        onFieldChange={handleFieldChange}
        syncState={templateSyncState}
        syncMessage={templateSyncMessage}
      />
      <ProjectResourcesSection settings={settings} onFieldChange={handleFieldChange} />
      <ServiceUrlsSection
        settings={settings}
        onFieldChange={handleFieldChange}
        secretBindings={secretBindings}
        onSecretBindingChange={handleSecretBindingChange}
      />

      <SettingsActions
        saving={saving}
        testing={testing}
        proxmoxOk={proxmoxOk}
        sshOk={sshOk}
        onSave={handleSave}
        onTestConnections={handleTestConnections}
      />
    </div>
  );
};
