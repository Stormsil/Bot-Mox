import { SaveOutlined } from '@ant-design/icons';

import type React from 'react';
import { AppButton as Button, AppFlex as Flex } from '../../../shared/ui';

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
