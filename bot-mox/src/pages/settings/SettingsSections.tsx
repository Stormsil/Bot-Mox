import React from 'react';
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Radio,
  Row,
  Space,
  Switch,
  Tag,
  Typography,
} from 'antd';
import {
  BellOutlined,
  CloudOutlined,
  DatabaseOutlined,
  DesktopOutlined,
  GlobalOutlined,
  KeyOutlined,
  LockOutlined,
  SafetyOutlined,
  SaveOutlined,
  SendOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import type { FormInstance } from 'antd';
import type { ProjectSettings } from '../../services/projectSettingsService';
import type {
  ApiKeysFormValues,
  NotificationEventsFormValues,
  ProxySettingsFormValues,
  StoragePolicyFormValues,
} from './types';

const { Text } = Typography;

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
        title={(
          <Space>
            <KeyOutlined />
            <span>API Keys</span>
          </Space>
        )}
        className="settings-card"
      >
        <Row gutter={[32, 16]}>
          <Col xs={24} lg={12}>
            <Card
              type="inner"
              title={(
                <Space>
                  <SafetyOutlined />
                  <span>IPQualityScore</span>
                </Space>
              )}
              className="inner-settings-card"
            >
              <Form
                form={form}
                layout="vertical"
                onFinish={onSave}
                disabled={loading}
              >
                <Form.Item
                  name="ipqs_enabled"
                  valuePropName="checked"
                  label="Enable IPQS Check"
                >
                  <Switch />
                </Form.Item>

                <Form.Item
                  label="API Key"
                  name="ipqs_api_key"
                >
                  <Input.Password placeholder="Enter IPQS API key" />
                </Form.Item>

                <Form.Item>
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    htmlType="submit"
                    loading={saving}
                  >
                    Save IPQS
                  </Button>
                </Form.Item>
              </Form>
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card
              type="inner"
              title={(
                <Space>
                  <SendOutlined />
                  <span>Telegram Bot</span>
                </Space>
              )}
              className="inner-settings-card"
            >
              <Form
                form={form}
                layout="vertical"
                onFinish={onSave}
                disabled={loading}
              >
                <Form.Item
                  name="telegram_enabled"
                  valuePropName="checked"
                  label="Enable Telegram Notifications"
                >
                  <Switch />
                </Form.Item>

                <Form.Item
                  label="Bot Token"
                  name="telegram_bot_token"
                >
                  <Input.Password placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz" />
                </Form.Item>

                <Form.Item
                  label="Chat ID"
                  name="telegram_chat_id"
                >
                  <Input placeholder="123456789 or @channelname" />
                </Form.Item>

                <Form.Item>
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    htmlType="submit"
                    loading={saving}
                  >
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
      <div className="settings-column-stack">
        <Card
          title={(
            <Space>
              <GlobalOutlined />
              <span>Proxy Settings</span>
            </Space>
          )}
          className="settings-card"
        >
          <Form
            form={proxyForm}
            layout="vertical"
            onFinish={onSaveProxySettings}
            disabled={loading}
          >
            <Form.Item
              name="auto_check_on_add"
              valuePropName="checked"
              label="Auto-check on Add"
            >
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
              <Button
                type="primary"
                icon={<SaveOutlined />}
                htmlType="submit"
                loading={saving}
              >
                Save Proxy Settings
              </Button>
            </Form.Item>
          </Form>
        </Card>

        <Card
          title={(
            <Space>
              <WarningOutlined />
              <span>Global Alerts</span>
            </Space>
          )}
          className="settings-card"
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
              <Button
                type="primary"
                icon={<SaveOutlined />}
                htmlType="submit"
                loading={saving}
              >
                Save Global Alerts
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </Col>
  );
};

interface NotificationsCardProps {
  form: FormInstance<NotificationEventsFormValues>;
  loading: boolean;
  saving: boolean;
  onSave: (values: NotificationEventsFormValues) => void;
}

export const NotificationsCard: React.FC<NotificationsCardProps> = ({ form, loading, saving, onSave }) => {
  return (
    <Col xs={24} lg={12} className="settings-notifications-col">
      <Card
        title={(
          <Space>
            <BellOutlined />
            <span>Notifications</span>
          </Space>
        )}
        className="settings-card settings-notifications-card"
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          Select events to notify via Telegram
        </Text>

        <Form
          form={form}
          layout="vertical"
          onFinish={onSave}
          disabled={loading}
        >
          <Row gutter={[16, 8]}>
            <Col span={12}><Form.Item name="bot_banned" valuePropName="checked" label="Bot Banned"><Switch /></Form.Item></Col>
            <Col span={12}><Form.Item name="bot_offline" valuePropName="checked" label="Bot Offline"><Switch /></Form.Item></Col>
            <Col span={12}><Form.Item name="bot_online" valuePropName="checked" label="Bot Online"><Switch /></Form.Item></Col>
            <Col span={12}><Form.Item name="level_up" valuePropName="checked" label="Level Up"><Switch /></Form.Item></Col>
            <Col span={12}><Form.Item name="profession_maxed" valuePropName="checked" label="Profession Maxed"><Switch /></Form.Item></Col>
            <Col span={12}><Form.Item name="low_fraud_score" valuePropName="checked" label="Low Fraud Score"><Switch /></Form.Item></Col>
            <Col span={12}><Form.Item name="daily_report" valuePropName="checked" label="Daily Report"><Switch /></Form.Item></Col>
          </Row>

          <Form.Item style={{ marginTop: 16 }}>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              htmlType="submit"
              loading={saving}
            >
              Save Notifications
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </Col>
  );
};

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
        title={(
          <Space>
            <DatabaseOutlined />
            <span>Storage Policy</span>
          </Space>
        )}
        className="settings-card"
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          Configure where operational data is stored. Secrets remain local-only on agent.
        </Text>

        <Form
          form={form}
          layout="vertical"
          onFinish={onSave}
          disabled={loading}
        >
          <Form.Item label="Secrets" style={{ marginBottom: 12 }}>
            <Space>
              <Tag color="green" icon={<LockOutlined />}>Local-only</Tag>
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
            <Button
              type="primary"
              icon={<SaveOutlined />}
              htmlType="submit"
              loading={saving}
            >
              Save Storage Policy
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </Col>
  );
};

interface ProjectsCardProps {
  projectsVisible: boolean;
  projectEntries: Array<[string, ProjectSettings]>;
  onToggleVisibility: () => void;
}

export const ProjectsCard: React.FC<ProjectsCardProps> = ({ projectsVisible, projectEntries, onToggleVisibility }) => {
  return (
    <Col span={24}>
      <Card
        title={(
          <Space>
            <DesktopOutlined />
            <span>Projects</span>
          </Space>
        )}
        extra={(
          <Button onClick={onToggleVisibility}>
            {projectsVisible ? 'Hide' : 'Show'}
          </Button>
        )}
        className="settings-card"
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
          View configured projects only. New project support is added by developers.
        </Text>
        {!projectsVisible ? null : projectEntries.length === 0 ? (
          <div className="project-settings-empty">
            <Text type="secondary">No projects configured yet</Text>
          </div>
        ) : (
          <div className="project-settings-list">
            {projectEntries.map(([projectId, project]) => (
              <div key={projectId} className="project-settings-item">
                <div className="project-settings-item-header">
                  <div className="project-settings-item-title">
                    <Text strong>{project.name || projectId}</Text>
                    <Text code>{projectId}</Text>
                  </div>
                </div>
                <div className="project-settings-item-meta">
                  <Text type="secondary">Game: {project.game || '-'}</Text>
                  <Text type="secondary">Expansion: {project.expansion || '-'}</Text>
                  <Text type="secondary">
                    Max level: {typeof project.max_level === 'number' ? project.max_level : '-'}
                  </Text>
                  <Text type="secondary">Region: {project.server_region || '-'}</Text>
                  <Text type="secondary">
                    Currency: {project.currency || '-'} {project.currency_symbol || ''}
                  </Text>
                  <Text type="secondary">
                    Professions: {Array.isArray(project.professions) && project.professions.length > 0
                      ? project.professions.join(', ')
                      : '-'}
                  </Text>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </Col>
  );
};
