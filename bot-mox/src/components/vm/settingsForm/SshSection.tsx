import React from 'react';
import { Input, InputNumber, Switch } from 'antd';
import type { SettingsSectionProps } from './types';
import { SecretField } from './SecretField';

export const SshSection: React.FC<SettingsSectionProps> = ({
  settings,
  onFieldChange,
  secretBindings,
  onSecretBindingChange,
}) => (
  <div className="vm-settings-section">
    <h4>SSH Connection</h4>
    <div className="vm-settings-row">
      <div className="vm-settings-field">
        <label>Host</label>
        <Input
          value={settings.ssh.host}
          onChange={(event) => onFieldChange('ssh.host', event.target.value)}
          size="small"
        />
      </div>
      <div className="vm-settings-field">
        <label>Port</label>
        <InputNumber
          value={settings.ssh.port}
          onChange={(value) => onFieldChange('ssh.port', value || 22)}
          size="small"
          min={1}
          max={65535}
          style={{ width: '100%' }}
        />
      </div>
    </div>
    <div className="vm-settings-row">
      <div className="vm-settings-field">
        <label>Username</label>
        <Input
          value={settings.ssh.username}
          onChange={(event) => onFieldChange('ssh.username', event.target.value)}
          size="small"
        />
      </div>
      <div className="vm-settings-field">
        <label>Use Key Auth</label>
        <div>
          <Switch
            checked={settings.ssh.useKeyAuth}
            onChange={(value) => onFieldChange('ssh.useKeyAuth', value)}
            size="small"
          />
        </div>
      </div>
    </div>
    {!settings.ssh.useKeyAuth && (
      <div className="vm-settings-row single">
        {onSecretBindingChange ? (
          <SecretField
            fieldName="ssh.password"
            label="Password"
            binding={secretBindings?.['ssh.password']}
            onBindingChange={onSecretBindingChange}
          />
        ) : (
          <div className="vm-settings-field">
            <label>Password</label>
            <Input.Password
              value={settings.ssh.password || ''}
              onChange={(event) => onFieldChange('ssh.password', event.target.value)}
              size="small"
            />
          </div>
        )}
      </div>
    )}
  </div>
);
