import React from 'react';
import { Input, InputNumber } from 'antd';
import type { TemplateSyncState, SettingsFieldUpdater } from './types';
import type { VMGeneratorSettings } from '../../../types';

interface TemplateStorageSectionProps {
  settings: VMGeneratorSettings;
  onFieldChange: SettingsFieldUpdater;
  syncState: TemplateSyncState;
  syncMessage: string;
}

export const TemplateStorageSection: React.FC<TemplateStorageSectionProps> = ({
  settings,
  onFieldChange,
  syncState,
  syncMessage,
}) => (
  <div className="vm-settings-section">
    <h4>Template & Storage</h4>
    <div className="vm-settings-row">
      <div className="vm-settings-field">
        <label>Clone Source VM ID</label>
        <InputNumber
          value={settings.template.vmId}
          onChange={(value) => onFieldChange('template.vmId', value || 100)}
          size="small"
          min={1}
          style={{ width: '100%' }}
        />
      </div>
      <div className="vm-settings-field">
        <label>Default Storage</label>
        <Input
          value={settings.storage.default}
          onChange={(event) => onFieldChange('storage.default', event.target.value)}
          size="small"
        />
      </div>
    </div>
    <div className="vm-settings-row single">
      <div className={`vm-settings-template-sync vm-settings-template-sync--${syncState}`}>
        {syncMessage || 'Template parameters will be loaded automatically from VM ID.'}
      </div>
    </div>
    <div className="vm-settings-row">
      <div className="vm-settings-field">
        <label>Default Format</label>
        <Input
          value={settings.format.default}
          onChange={(event) => onFieldChange('format.default', event.target.value)}
          size="small"
        />
      </div>
      <div className="vm-settings-field">
        <label>Storage Options (comma-separated)</label>
        <Input
          value={settings.storage.options.join(', ')}
          onChange={(event) =>
            onFieldChange(
              'storage.options',
              event.target.value
                .split(',')
                .map((part) => part.trim())
                .filter(Boolean)
            )
          }
          size="small"
        />
      </div>
    </div>
  </div>
);
