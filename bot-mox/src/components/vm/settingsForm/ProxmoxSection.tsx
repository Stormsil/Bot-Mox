import React from 'react';
import { Input } from 'antd';
import type { SettingsSectionProps } from './types';
import { SecretField } from './SecretField';

export const ProxmoxSection: React.FC<SettingsSectionProps> = ({
  settings,
  onFieldChange,
  secretBindings,
  onSecretBindingChange,
}) => (
  <div className="vm-settings-section">
    <h4>Proxmox Connection</h4>
    <div className="vm-settings-row">
      <div className="vm-settings-field">
        <label>URL</label>
        <Input
          value={settings.proxmox.url}
          onChange={(event) => onFieldChange('proxmox.url', event.target.value)}
          size="small"
        />
      </div>
      <div className="vm-settings-field">
        <label>Node</label>
        <Input
          value={settings.proxmox.node}
          onChange={(event) => onFieldChange('proxmox.node', event.target.value)}
          size="small"
        />
      </div>
    </div>
    <div className="vm-settings-row">
      <div className="vm-settings-field">
        <label>Username</label>
        <Input
          value={settings.proxmox.username}
          onChange={(event) => onFieldChange('proxmox.username', event.target.value)}
          size="small"
        />
      </div>
      {onSecretBindingChange ? (
        <SecretField
          fieldName="proxmox.password"
          label="Password"
          binding={secretBindings?.['proxmox.password']}
          onBindingChange={onSecretBindingChange}
        />
      ) : (
        <div className="vm-settings-field">
          <label>Password</label>
          <Input.Password
            value={settings.proxmox.password ?? ''}
            onChange={(event) => onFieldChange('proxmox.password', event.target.value)}
            size="small"
          />
        </div>
      )}
    </div>
  </div>
);
