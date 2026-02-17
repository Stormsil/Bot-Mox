import React from 'react';
import { SaveOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import layout from './SettingsSectionLayout.module.css';

interface SettingsActionsProps {
  saving: boolean;
  onSave: () => void;
}

export const SettingsActions: React.FC<SettingsActionsProps> = ({
  saving,
  onSave,
}) => (
  <div className={layout.actions}>
    <Button type="primary" icon={<SaveOutlined />} onClick={onSave} loading={saving}>
      Save Settings
    </Button>
  </div>
);
