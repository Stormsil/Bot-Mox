import React from 'react';
import { Input } from 'antd';
import type { SettingsSectionProps } from './types';
import { SecretField } from './SecretField';
import layout from './SettingsSectionLayout.module.css';

export const ProxmoxSection: React.FC<SettingsSectionProps> = ({
  settings,
  onFieldChange,
  secretBindings,
  onSecretBindingChange,
}) => (
  <div className={layout.section}>
    <h4>Proxmox Connection</h4>
    <div className={layout.row}>
      <div className={layout.field}>
        <label>URL</label>
        <Input
          value={settings.proxmox.url}
          onChange={(event) => onFieldChange('proxmox.url', event.target.value)}
          size="small"
        />
      </div>
      <div className={layout.field}>
        <label>Node</label>
        <Input
          value={settings.proxmox.node}
          onChange={(event) => onFieldChange('proxmox.node', event.target.value)}
          size="small"
        />
      </div>
    </div>
    <div className={layout.row}>
      <div className={layout.field}>
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
        <div className={layout.field}>
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
