import { KeyOutlined, SafetyOutlined, SaveOutlined, SendOutlined } from '@ant-design/icons';
import type { FormInstance } from 'antd';
import { Button, Card, Col, Form, Input, Row, Space, Switch } from 'antd';
import type React from 'react';
import type { ApiKeysFormValues } from '../types';
import { cx } from './classNames';

const INNER_SETTINGS_CARD_STYLE: React.CSSProperties = {
  background: 'var(--boxmox-color-surface-muted)',
  border: '1px solid var(--boxmox-color-border-default)',
};

const INNER_SETTINGS_CARD_STYLES: NonNullable<React.ComponentProps<typeof Card>['styles']> = {
  header: {
    background: 'var(--boxmox-color-surface-hover)',
    borderBottom: '1px solid var(--boxmox-color-border-default)',
    padding: '8px 12px',
    fontSize: 14,
  },
  body: {
    background: 'var(--boxmox-color-surface-muted)',
    padding: 16,
  },
};

interface ApiKeysCardProps {
  form: FormInstance<ApiKeysFormValues>;
  loading: boolean;
  saving: boolean;
  onSave: (values: ApiKeysFormValues) => void;
}

export const ApiKeysCard: React.FC<ApiKeysCardProps> = ({ form, loading, saving, onSave }) => {
  return (
    <Col span={24}>
      <Card
        title={
          <Space>
            <KeyOutlined />
            <span>API Keys</span>
          </Space>
        }
        className={cx('settings-card')}
      >
        <Row gutter={[32, 16]}>
          <Col xs={24} lg={12}>
            <Card
              type="inner"
              title={
                <Space>
                  <SafetyOutlined />
                  <span>IPQualityScore</span>
                </Space>
              }
              style={INNER_SETTINGS_CARD_STYLE}
              styles={INNER_SETTINGS_CARD_STYLES}
            >
              <Form form={form} layout="vertical" onFinish={onSave} disabled={loading}>
                <Form.Item name="ipqs_enabled" valuePropName="checked" label="Enable IPQS Check">
                  <Switch />
                </Form.Item>

                <Form.Item label="API Key" name="ipqs_api_key">
                  <Input.Password placeholder="Enter IPQS API key" />
                </Form.Item>

                <Form.Item>
                  <Button type="primary" icon={<SaveOutlined />} htmlType="submit" loading={saving}>
                    Save IPQS
                  </Button>
                </Form.Item>
              </Form>
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card
              type="inner"
              title={
                <Space>
                  <SendOutlined />
                  <span>Telegram Bot</span>
                </Space>
              }
              style={INNER_SETTINGS_CARD_STYLE}
              styles={INNER_SETTINGS_CARD_STYLES}
            >
              <Form form={form} layout="vertical" onFinish={onSave} disabled={loading}>
                <Form.Item
                  name="telegram_enabled"
                  valuePropName="checked"
                  label="Enable Telegram Notifications"
                >
                  <Switch />
                </Form.Item>

                <Form.Item label="Bot Token" name="telegram_bot_token">
                  <Input.Password placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz" />
                </Form.Item>

                <Form.Item label="Chat ID" name="telegram_chat_id">
                  <Input placeholder="123456789 or @channelname" />
                </Form.Item>

                <Form.Item>
                  <Button type="primary" icon={<SaveOutlined />} htmlType="submit" loading={saving}>
                    Save Telegram
                  </Button>
                </Form.Item>
              </Form>
            </Card>
          </Col>
        </Row>
      </Card>
    </Col>
  );
};
