import React from 'react';
import { Checkbox, Form } from 'antd';
import type { UnattendProfileConfig, UnattendWindowsSettings } from '../../../../services/unattendProfileService';

const TOGGLE_LABELS: Record<keyof UnattendWindowsSettings, string> = {
  disableDefender: 'Disable Windows Defender',
  disableWindowsUpdate: 'Disable Windows Update',
  disableUac: 'Disable UAC',
  disableSmartScreen: 'Disable SmartScreen',
  disableSystemRestore: 'Disable System Restore',
  enableLongPaths: 'Enable Long Paths',
  allowPowerShellScripts: 'Allow PowerShell Scripts (Bypass)',
  disableWidgets: 'Disable Widgets',
  disableEdgeStartup: 'Disable Edge First Run',
  preventDeviceEncryption: 'Prevent Device Encryption (BitLocker)',
  disableStickyKeys: 'Disable Sticky Keys',
  enableRemoteDesktop: 'Enable Remote Desktop',
};

interface WindowsSettingsSectionProps {
  config: UnattendProfileConfig;
  updateConfig: <K extends keyof UnattendProfileConfig>(section: K, patch: Partial<UnattendProfileConfig[K]>) => void;
}

export const WindowsSettingsSection: React.FC<WindowsSettingsSectionProps> = ({ config, updateConfig }) => (
  <Form layout="vertical" size="small">
    {(Object.keys(TOGGLE_LABELS) as Array<keyof UnattendWindowsSettings>).map((key) => (
      <Form.Item key={key} style={{ marginBottom: 4 }}>
        <Checkbox
          checked={config.windowsSettings[key]}
          onChange={(e) => updateConfig('windowsSettings', { [key]: e.target.checked })}
        >
          {TOGGLE_LABELS[key]}
        </Checkbox>
      </Form.Item>
    ))}
  </Form>
);
