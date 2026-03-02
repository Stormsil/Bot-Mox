import type React from 'react';
import {
  AppCol as Col,
  AppFlex as Flex,
  AppInput as Input,
  AppInputNumber as InputNumber,
  AppRow as Row,
  AppSwitch as Switch,
} from '../../../shared/ui';
import { SecretField } from './SecretField';
import layout from './SettingsSectionLayout.module.css';
import type { SettingsSectionProps } from './types';

export const SshSection: React.FC<SettingsSectionProps> = ({
  settings,
  onFieldChange,
  secretBindings,
  onSecretBindingChange,
}) => (
  <div className={layout.section}>
    <h4>SSH Connection</h4>
    <Flex vertical gap={12}>
      <Row gutter={12}>
        <Col span={12}>
          <div className={layout.field}>
            <div className={layout.fieldLabel}>Host</div>
            <Input
              value={settings.ssh.host}
              onChange={(event) => onFieldChange('ssh.host', event.target.value)}
              size="small"
            />
          </div>
        </Col>
        <Col span={12}>
          <div className={layout.field}>
            <div className={layout.fieldLabel}>Port</div>
            <InputNumber
              value={settings.ssh.port}
              onChange={(value) => onFieldChange('ssh.port', value || 22)}
              size="small"
              min={1}
              max={65535}
              style={{ width: '100%' }}
            />
          </div>
        </Col>
      </Row>
      <Row gutter={12}>
        <Col span={12}>
          <div className={layout.field}>
            <div className={layout.fieldLabel}>Username</div>
            <Input
              value={settings.ssh.username}
              onChange={(event) => onFieldChange('ssh.username', event.target.value)}
              size="small"
            />
          </div>
        </Col>
        <Col span={12}>
          <div className={layout.field}>
            <div className={layout.fieldLabel}>Use Key Auth</div>
            <div>
              <Switch
                checked={settings.ssh.useKeyAuth}
                onChange={(value) => onFieldChange('ssh.useKeyAuth', value)}
                size="small"
              />
            </div>
          </div>
        </Col>
      </Row>
      {!settings.ssh.useKeyAuth && (
        <Row gutter={12}>
          <Col span={24}>
            {onSecretBindingChange ? (
              <SecretField
                fieldName="ssh.password"
                label="Password"
                binding={secretBindings?.['ssh.password']}
                onBindingChange={onSecretBindingChange}
              />
            ) : (
              <div className={layout.field}>
                <div className={layout.fieldLabel}>Password</div>
                <Input.Password
                  value={settings.ssh.password || ''}
                  onChange={(event) => onFieldChange('ssh.password', event.target.value)}
                  size="small"
                />
              </div>
            )}
          </Col>
        </Row>
      )}
    </Flex>
  </div>
);
