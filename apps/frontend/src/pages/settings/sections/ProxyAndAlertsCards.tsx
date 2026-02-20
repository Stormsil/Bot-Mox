import { GlobalOutlined, SaveOutlined, WarningOutlined } from '@ant-design/icons';
import type { FormInstance } from 'antd';
import { Button, Card, Col, Form, InputNumber, Space, Switch, Typography } from 'antd';
import type React from 'react';
import type { ProxySettingsFormValues } from '../types';
import { cx } from './classNames';

const { Text } = Typography;

interface ProxyAndAlertsCardsProps {
  proxyForm: FormInstance<ProxySettingsFormValues>;
  alertsForm: FormInstance<{ warning_days: number }>;
  loading: boolean;
  saving: boolean;
  onSaveProxySettings: (values: ProxySettingsFormValues) => void;
  onSaveGlobalAlerts: (values: { warning_days: number }) => void;
}

export const ProxyAndAlertsCards: React.FC<ProxyAndAlertsCardsProps> = ({
  proxyForm,
  alertsForm,
  loading,
  saving,
  onSaveProxySettings,
  onSaveGlobalAlerts,
}) => {
  return (
    <Col xs={24} lg={12}>
      <div className={cx('settings-column-stack')}>
        <Card
          title={
            <Space>
              <GlobalOutlined />
              <span>Proxy Settings</span>
            </Space>
          }
          className={cx('settings-card')}
        >
          <Form
            form={proxyForm}
            layout="vertical"
            onFinish={onSaveProxySettings}
            disabled={loading}
          >
            <Form.Item name="auto_check_on_add" valuePropName="checked" label="Auto-check on Add">
              <Switch />
            </Form.Item>

            <Form.Item
              label="Fraud Score Threshold"
              name="fraud_score_threshold"
              rules={[{ required: true, min: 0, max: 100 }]}
              extra="Proxies with fraud score above this value will be flagged (0-100)"
            >
              <InputNumber min={0} max={100} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item
              label="Check Interval (hours)"
              name="check_interval_hours"
              rules={[{ required: true, min: 0 }]}
              extra="0 = disabled"
            >
              <InputNumber min={0} max={168} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item>
              <Button type="primary" icon={<SaveOutlined />} htmlType="submit" loading={saving}>
                Save Proxy Settings
              </Button>
            </Form.Item>
          </Form>
        </Card>

        <Card
          title={
            <Space>
              <WarningOutlined />
              <span>Global Alerts</span>
            </Space>
          }
          className={cx('settings-card')}
        >
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            Common expiration warning threshold for licenses, proxies and subscriptions.
          </Text>

          <Form
            form={alertsForm}
            layout="vertical"
            onFinish={onSaveGlobalAlerts}
            disabled={loading}
          >
            <Form.Item
              label="Warn before (days)"
              name="warning_days"
              rules={[
                { required: true, message: 'Enter number of days' },
                { type: 'number', min: 1, max: 90, message: 'From 1 to 90 days' },
              ]}
            >
              <InputNumber min={1} max={90} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item>
              <Button type="primary" icon={<SaveOutlined />} htmlType="submit" loading={saving}>
                Save Global Alerts
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </Col>
  );
};
