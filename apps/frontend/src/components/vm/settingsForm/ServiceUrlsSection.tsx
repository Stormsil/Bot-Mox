import { Input, Switch } from 'antd';
import type React from 'react';
import { SecretField } from './SecretField';
import layout from './SettingsSectionLayout.module.css';
import type { SettingsSectionProps } from './types';

export const ServiceUrlsSection: React.FC<SettingsSectionProps> = ({
  settings,
  onFieldChange,
  secretBindings,
  onSecretBindingChange,
}) => (
  <div className={layout.section}>
    <h4>Service URLs</h4>
    <div className={`${layout.row} ${layout.rowSingle}`}>
      <div className={layout.field}>
        <div className={layout.fieldLabel}>Proxmox UI URL</div>
        <Input
          value={settings.services.proxmoxUrl}
          onChange={(event) => onFieldChange('services.proxmoxUrl', event.target.value)}
          size="small"
        />
      </div>
    </div>
    <div className={`${layout.row} ${layout.rowSingle}`}>
      <div className={layout.field}>
        <div className={layout.fieldLabel}>Proxmox Auto Login</div>
        <div>
          <Switch
            checked={settings.services.proxmoxAutoLogin}
            onChange={(value) => onFieldChange('services.proxmoxAutoLogin', value)}
            size="small"
          />
        </div>
      </div>
    </div>
    <div className={layout.row}>
      <div className={layout.field}>
        <div className={layout.fieldLabel}>TinyFileManager URL</div>
        <Input
          value={settings.services.tinyFmUrl}
          onChange={(event) => onFieldChange('services.tinyFmUrl', event.target.value)}
          size="small"
        />
      </div>
      <div className={layout.field}>
        <div className={layout.fieldLabel}>SyncThing URL</div>
        <Input
          value={settings.services.syncThingUrl}
          onChange={(event) => onFieldChange('services.syncThingUrl', event.target.value)}
          size="small"
        />
      </div>
    </div>
    <div className={layout.row}>
      <div className={layout.field}>
        <div className={layout.fieldLabel}>TinyFM Username</div>
        <Input
          value={settings.services.tinyFmUsername}
          onChange={(event) => onFieldChange('services.tinyFmUsername', event.target.value)}
          size="small"
        />
      </div>
      {onSecretBindingChange ? (
        <SecretField
          fieldName="services.tinyFmPassword"
          label="TinyFM Password"
          binding={secretBindings?.['services.tinyFmPassword']}
          onBindingChange={onSecretBindingChange}
        />
      ) : (
        <div className={layout.field}>
          <div className={layout.fieldLabel}>TinyFM Password</div>
          <Input.Password
            value={settings.services.tinyFmPassword ?? ''}
            onChange={(event) => onFieldChange('services.tinyFmPassword', event.target.value)}
            size="small"
          />
        </div>
      )}
    </div>
    <div className={layout.row}>
      <div className={layout.field}>
        <div className={layout.fieldLabel}>TinyFM Auto Login</div>
        <div>
          <Switch
            checked={settings.services.tinyFmAutoLogin}
            onChange={(value) => onFieldChange('services.tinyFmAutoLogin', value)}
            size="small"
          />
        </div>
      </div>
      <div className={layout.field}>
        <div className={layout.fieldLabel}>SyncThing Auto Login</div>
        <div>
          <Switch
            checked={settings.services.syncThingAutoLogin}
            onChange={(value) => onFieldChange('services.syncThingAutoLogin', value)}
            size="small"
          />
        </div>
      </div>
    </div>
    <div className={layout.row}>
      <div className={layout.field}>
        <div className={layout.fieldLabel}>SyncThing Username</div>
        <Input
          value={settings.services.syncThingUsername}
          onChange={(event) => onFieldChange('services.syncThingUsername', event.target.value)}
          size="small"
        />
      </div>
      {onSecretBindingChange ? (
        <SecretField
          fieldName="services.syncThingPassword"
          label="SyncThing Password"
          binding={secretBindings?.['services.syncThingPassword']}
          onBindingChange={onSecretBindingChange}
        />
      ) : (
        <div className={layout.field}>
          <div className={layout.fieldLabel}>SyncThing Password</div>
          <Input.Password
            value={settings.services.syncThingPassword ?? ''}
            onChange={(event) => onFieldChange('services.syncThingPassword', event.target.value)}
            size="small"
          />
        </div>
      )}
    </div>
  </div>
);
