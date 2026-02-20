import { BellOutlined, SaveOutlined } from '@ant-design/icons';
import type { FormInstance } from 'antd';
import { Button, Card, Col, Form, Row, Space, Switch, Typography } from 'antd';
import type React from 'react';
import type { NotificationEventsFormValues } from '../types';
import { cx } from './classNames';

const { Text } = Typography;

interface NotificationsCardProps {
  form: FormInstance<NotificationEventsFormValues>;
  loading: boolean;
  saving: boolean;
  onSave: (values: NotificationEventsFormValues) => void;
}

export const NotificationsCard: React.FC<NotificationsCardProps> = ({
  form,
  loading,
  saving,
  onSave,
}) => {
  return (
    <Col xs={24} lg={12} className={cx('settings-notifications-col')}>
      <Card
        title={
          <Space>
            <BellOutlined />
            <span>Notifications</span>
          </Space>
        }
        className={cx('settings-card settings-notifications-card')}
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          Select events to notify via Telegram
        </Text>

        <Form form={form} layout="vertical" onFinish={onSave} disabled={loading}>
          <Row gutter={[16, 8]}>
            <Col span={12}>
              <Form.Item name="bot_banned" valuePropName="checked" label="Bot Banned">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="bot_offline" valuePropName="checked" label="Bot Offline">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="bot_online" valuePropName="checked" label="Bot Online">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="level_up" valuePropName="checked" label="Level Up">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="profession_maxed" valuePropName="checked" label="Profession Maxed">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="low_fraud_score" valuePropName="checked" label="Low Fraud Score">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="daily_report" valuePropName="checked" label="Daily Report">
                <Switch />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item style={{ marginTop: 16 }}>
            <Button type="primary" icon={<SaveOutlined />} htmlType="submit" loading={saving}>
              Save Notifications
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </Col>
  );
};
