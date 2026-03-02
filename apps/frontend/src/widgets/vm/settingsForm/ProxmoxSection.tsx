import { Col, Flex, Input, Row } from 'antd';
import type React from 'react';
import { SecretField } from './SecretField';
import layout from './SettingsSectionLayout.module.css';
import type { SettingsSectionProps } from './types';

export const ProxmoxSection: React.FC<SettingsSectionProps> = ({
  settings,
  onFieldChange,
  secretBindings,
  onSecretBindingChange,
}) => (
  <div className={layout.section}>
    <h4>Proxmox Connection</h4>
    <Flex vertical gap={12}>
      <Row gutter={12}>
        <Col span={12}>
          <div className={layout.field}>
            <div className={layout.fieldLabel}>URL</div>
            <Input
              value={settings.proxmox.url}
              onChange={(event) => onFieldChange('proxmox.url', event.target.value)}
              size="small"
            />
          </div>
        </Col>
        <Col span={12}>
          <div className={layout.field}>
            <div className={layout.fieldLabel}>Node</div>
            <Input
              value={settings.proxmox.node}
              onChange={(event) => onFieldChange('proxmox.node', event.target.value)}
              size="small"
            />
          </div>
        </Col>
      </Row>
      <Row gutter={12}>
        <Col span={12}>
          <div className={layout.field}>
            <div className={layout.fieldLabel}>Username</div>
            <Input
              value={settings.proxmox.username}
              onChange={(event) => onFieldChange('proxmox.username', event.target.value)}
              size="small"
            />
          </div>
        </Col>
        <Col span={12}>
          {onSecretBindingChange ? (
            <SecretField
              fieldName="proxmox.password"
              label="Password"
              binding={secretBindings?.['proxmox.password']}
              onBindingChange={onSecretBindingChange}
            />
          ) : (
            <div className={layout.field}>
              <div className={layout.fieldLabel}>Password</div>
              <Input.Password
                value={settings.proxmox.password ?? ''}
                onChange={(event) => onFieldChange('proxmox.password', event.target.value)}
                size="small"
              />
            </div>
          )}
        </Col>
      </Row>
    </Flex>
  </div>
);
