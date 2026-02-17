import React from 'react';
import { Form, Input, InputNumber, Radio, Select, Typography } from 'antd';
import type { UnattendProfileConfig } from '../../../../services/unattendProfileService';

const { Text } = Typography;

interface AccountSectionProps {
  config: UnattendProfileConfig;
  updateConfig: <K extends keyof UnattendProfileConfig>(section: K, patch: Partial<UnattendProfileConfig[K]>) => void;
}

export const AccountSection: React.FC<AccountSectionProps> = ({ config, updateConfig }) => (
  <Form layout="vertical" size="small">
    <Form.Item label="Username mode">
      <Radio.Group
        value={config.user.nameMode}
        onChange={(e) => updateConfig('user', { nameMode: e.target.value })}
      >
        <Radio value="random">Random (Adjective+Noun+Number)</Radio>
        <Radio value="fixed">Fixed (User)</Radio>
        <Radio value="custom">Custom pattern</Radio>
      </Radio.Group>
    </Form.Item>

    {config.user.nameMode === 'custom' && (
      <>
        <Form.Item label="Custom username">
          <Input
            value={config.user.customName || ''}
            onChange={(e) => updateConfig('user', { customName: e.target.value })}
          />
        </Form.Item>
        <Form.Item label="Name suffix">
          <Select
            value={config.user.customNameSuffix || 'none'}
            onChange={(value) => updateConfig('user', { customNameSuffix: value })}
            options={[
              { value: 'none', label: 'None' },
              { value: 'random_digits', label: 'Random digits (2-4)' },
              { value: 'sequential', label: 'Sequential (caller provides index)' },
            ]}
            style={{ width: 260 }}
          />
        </Form.Item>
      </>
    )}

    <Form.Item label="Display name (optional)">
      <Input
        value={config.user.displayName || ''}
        onChange={(e) => updateConfig('user', { displayName: e.target.value })}
        placeholder="Defaults to generated username"
      />
    </Form.Item>

    <Form.Item label="Password">
      <Input.Password
        value={config.user.password}
        onChange={(e) => updateConfig('user', { password: e.target.value })}
      />
    </Form.Item>

    <Form.Item label="Group">
      <Radio.Group
        value={config.user.group}
        onChange={(e) => updateConfig('user', { group: e.target.value })}
      >
        <Radio value="Administrators">Administrators</Radio>
        <Radio value="Users">Users</Radio>
      </Radio.Group>
    </Form.Item>

    <Form.Item label="Auto-logon count">
      <InputNumber
        value={config.user.autoLogonCount}
        onChange={(v) => updateConfig('user', { autoLogonCount: v ?? 9999999 })}
        min={0}
        max={99999999}
        style={{ width: 200 }}
      />
      <Text type="secondary" style={{ marginLeft: 8 }}>
        Set high (9999999) for permanent auto-login
      </Text>
    </Form.Item>

    <Form.Item label="Computer name mode">
      <Radio.Group
        value={config.computerName.mode}
        onChange={(e) => updateConfig('computerName', { mode: e.target.value })}
      >
        <Radio value="random">Random (DESKTOP-XXXXXXX)</Radio>
        <Radio value="fixed">Fixed (WIN-PC)</Radio>
        <Radio value="custom">Custom</Radio>
      </Radio.Group>
    </Form.Item>
    {config.computerName.mode === 'custom' && (
      <Form.Item label="Custom name (max 15 chars)">
        <Input
          maxLength={15}
          value={config.computerName.customName || ''}
          onChange={(e) => updateConfig('computerName', { customName: e.target.value })}
        />
      </Form.Item>
    )}
  </Form>
);
