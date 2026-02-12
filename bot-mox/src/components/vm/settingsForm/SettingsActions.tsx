import React from 'react';
import { ApiOutlined, CheckCircleOutlined, CloseCircleOutlined, SaveOutlined } from '@ant-design/icons';
import { Button, Tag } from 'antd';

interface SettingsActionsProps {
  saving: boolean;
  testing: boolean;
  proxmoxOk: boolean | null;
  sshOk: boolean | null;
  onSave: () => void;
  onTestConnections: () => void;
}

export const SettingsActions: React.FC<SettingsActionsProps> = ({
  saving,
  testing,
  proxmoxOk,
  sshOk,
  onSave,
  onTestConnections,
}) => (
  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
    <Button type="primary" icon={<SaveOutlined />} onClick={onSave} loading={saving}>
      Save Settings
    </Button>
    <Button icon={<ApiOutlined />} onClick={onTestConnections} loading={testing}>
      Test Connections
    </Button>

    {proxmoxOk !== null && (
      <Tag
        icon={proxmoxOk ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
        color={proxmoxOk ? 'success' : 'error'}
      >
        Proxmox: {proxmoxOk ? 'OK' : 'Failed'}
      </Tag>
    )}
    {sshOk !== null && (
      <Tag icon={sshOk ? <CheckCircleOutlined /> : <CloseCircleOutlined />} color={sshOk ? 'success' : 'error'}>
        SSH: {sshOk ? 'OK' : 'Failed'}
      </Tag>
    )}
  </div>
);
