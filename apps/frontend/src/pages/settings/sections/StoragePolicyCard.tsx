import { CloudOutlined, DatabaseOutlined, LockOutlined, SaveOutlined } from '@ant-design/icons';
import type { FormInstance } from 'antd';
import { Button, Card, Col, Form, Radio, Space, Switch, Tag, Typography } from 'antd';
import type React from 'react';
import type { StoragePolicyFormValues } from '../types';
import { cx } from './classNames';

const { Text } = Typography;

interface StoragePolicyCardProps {
  form: FormInstance<StoragePolicyFormValues>;
  loading: boolean;
  saving: boolean;
  onSave: (values: StoragePolicyFormValues) => void;
}

export const StoragePolicyCard: React.FC<StoragePolicyCardProps> = ({
  form,
  loading,
  saving,
  onSave,
}) => {
  return (
    <Col xs={24} lg={12}>
      <Card
        title={
          <Space>
            <DatabaseOutlined />
            <span>Storage Policy</span>
          </Space>
        }
        className={cx('settings-card')}
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          Configure where operational data is stored. Secrets remain local-only on agent.
        </Text>

        <Form form={form} layout="vertical" onFinish={onSave} disabled={loading}>
          <Form.Item label="Secrets" style={{ marginBottom: 12 }}>
            <Space>
              <Tag color="green" icon={<LockOutlined />}>
                Local-only
              </Tag>
              <Text type="secondary">Fixed security policy</Text>
            </Space>
          </Form.Item>

          <Form.Item
            label="Operational data"
            name="operational"
            rules={[{ required: true, message: 'Select operational storage mode' }]}
            extra="Local: keep runtime data on customer infrastructure. Cloud: keep runtime data in control-plane."
          >
            <Radio.Group>
              <Radio.Button value="local">
                <DatabaseOutlined /> Local
              </Radio.Button>
              <Radio.Button value="cloud">
                <CloudOutlined /> Cloud
              </Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            name="sync_enabled"
            valuePropName="checked"
            label="Sync adapter"
            extra="Optional bridge for synchronizing local runtime data to cloud telemetry."
          >
            <Switch />
          </Form.Item>

          <Form.Item>
            <Button type="primary" icon={<SaveOutlined />} htmlType="submit" loading={saving}>
              Save Storage Policy
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </Col>
  );
};
