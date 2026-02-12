import React from 'react';
import { InputNumber } from 'antd';
import type { SettingsSectionProps } from './types';

export const ProjectResourcesSection: React.FC<SettingsSectionProps> = ({ settings, onFieldChange }) => (
  <div className="vm-settings-section">
    <h4>Project Resources (Cores/Memory only)</h4>
    <div className="vm-settings-row">
      <div className="vm-settings-field">
        <label>Default Cores (fallback)</label>
        <InputNumber
          value={settings.hardware.cores}
          onChange={(value) => onFieldChange('hardware.cores', value || 1)}
          size="small"
          min={1}
          max={64}
          style={{ width: '100%' }}
        />
      </div>
      <div className="vm-settings-field">
        <label>Default Memory (MB, fallback)</label>
        <InputNumber
          value={settings.hardware.memory}
          onChange={(value) => onFieldChange('hardware.memory', value || 512)}
          size="small"
          min={256}
          max={262144}
          step={256}
          style={{ width: '100%' }}
        />
      </div>
    </div>
    <div className="vm-settings-row">
      <div className="vm-settings-field">
        <label>WoW TBC Cores</label>
        <InputNumber
          value={settings.projectHardware.wow_tbc.cores}
          onChange={(value) => onFieldChange('projectHardware.wow_tbc.cores', value || 1)}
          size="small"
          min={1}
          max={64}
          style={{ width: '100%' }}
        />
      </div>
      <div className="vm-settings-field">
        <label>WoW TBC Memory (MB)</label>
        <InputNumber
          value={settings.projectHardware.wow_tbc.memory}
          onChange={(value) => onFieldChange('projectHardware.wow_tbc.memory', value || 512)}
          size="small"
          min={256}
          max={262144}
          step={256}
          style={{ width: '100%' }}
        />
      </div>
    </div>
    <div className="vm-settings-row">
      <div className="vm-settings-field">
        <label>WoW Midnight Cores</label>
        <InputNumber
          value={settings.projectHardware.wow_midnight.cores}
          onChange={(value) => onFieldChange('projectHardware.wow_midnight.cores', value || 1)}
          size="small"
          min={1}
          max={64}
          style={{ width: '100%' }}
        />
      </div>
      <div className="vm-settings-field">
        <label>WoW Midnight Memory (MB)</label>
        <InputNumber
          value={settings.projectHardware.wow_midnight.memory}
          onChange={(value) => onFieldChange('projectHardware.wow_midnight.memory', value || 512)}
          size="small"
          min={256}
          max={262144}
          step={256}
          style={{ width: '100%' }}
        />
      </div>
    </div>
  </div>
);
