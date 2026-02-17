import { Button, Col, Form, Input, Row, Select } from 'antd';
import type { ReactNode } from 'react';
import { EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons';
import { popularEmailDomains } from '../../../utils/accountGenerators';
import styles from './account.module.css';

const { Option } = Select;

interface EmailSectionProps {
  accountLocked: boolean;
  emailWarning: ReactNode;
  selectedDomain: string;
  setSelectedDomain: (value: string) => void;
  useCustomDomain: boolean;
  customDomain: string;
  setCustomDomain: (value: string) => void;
  setUseCustomDomain: (value: boolean) => void;
}

export function EmailSection({
  accountLocked,
  emailWarning,
  selectedDomain,
  setSelectedDomain,
  useCustomDomain,
  customDomain,
  setCustomDomain,
  setUseCustomDomain,
}: EmailSectionProps) {
  return (
    <Row gutter={16}>
      <Col xs={24} md={16}>
        <Form.Item
          label={(
            <span className={styles['field-label']}>
              Email
              {emailWarning}
            </span>
          )}
          name="email"
        >
          <Input
            placeholder="Enter email address"
            autoComplete="off"
            disabled={accountLocked}
          />
        </Form.Item>
      </Col>
      <Col xs={24} md={8}>
        <Form.Item label="Email Domain">
          <Form.Item noStyle>
            <div>
              {!useCustomDomain ? (
                <Select
                  value={selectedDomain}
                  onChange={setSelectedDomain}
                  style={{ width: '100%' }}
                  disabled={accountLocked}
                >
                  {popularEmailDomains.map((domain) => (
                    <Option key={domain} value={domain}>
                      {domain}
                    </Option>
                  ))}
                  <Option value="custom">Custom...</Option>
                </Select>
              ) : (
                <Input
                  placeholder="Enter custom domain"
                  value={customDomain}
                  onChange={(event) => setCustomDomain(event.target.value)}
                  disabled={accountLocked}
                  suffix={(
                    <Button
                      type="text"
                      size="small"
                      onClick={() => setUseCustomDomain(false)}
                      disabled={accountLocked}
                    >
                      Back
                    </Button>
                  )}
                />
              )}
              {selectedDomain === 'custom' && !useCustomDomain && (
                <Button
                  type="link"
                  size="small"
                  onClick={() => setUseCustomDomain(true)}
                  disabled={accountLocked}
                >
                  Enter custom domain
                </Button>
              )}
            </div>
          </Form.Item>
        </Form.Item>
      </Col>
    </Row>
  );
}

interface PasswordSectionProps {
  accountLocked: boolean;
  passwordWarning: ReactNode;
  showPassword: boolean;
  setShowPassword: (value: boolean | ((prev: boolean) => boolean)) => void;
}

export function PasswordSection({
  accountLocked,
  passwordWarning,
  showPassword,
  setShowPassword,
}: PasswordSectionProps) {
  return (
    <Row gutter={16}>
      <Col xs={24} md={16}>
        <Form.Item
          label={(
            <span className={styles['field-label']}>
              Password
              {passwordWarning}
            </span>
          )}
          name="password"
        >
          <Input
            type={showPassword ? 'text' : 'password'}
            placeholder="Enter password"
            autoComplete="off"
            disabled={accountLocked}
            suffix={(
              <Button
                type="text"
                size="small"
                icon={showPassword ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                onClick={() => setShowPassword((prev) => !prev)}
                disabled={accountLocked}
              />
            )}
          />
        </Form.Item>
      </Col>
    </Row>
  );
}
