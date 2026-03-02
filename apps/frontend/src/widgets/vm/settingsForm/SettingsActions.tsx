import { SaveOutlined } from '@ant-design/icons';
import { Button, Flex } from 'antd';
import type React from 'react';

interface SettingsActionsProps {
  saving: boolean;
  onSave: () => void;
}

export const SettingsActions: React.FC<SettingsActionsProps> = ({ saving, onSave }) => (
  <Flex gap={8} align="center">
    <Button type="primary" icon={<SaveOutlined />} onClick={onSave} loading={saving}>
      Save Settings
    </Button>
  </Flex>
);
