import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Switch, Button, Typography, message, Space, InputNumber, Row, Col } from 'antd';
import {
  KeyOutlined,
  SafetyOutlined,
  SendOutlined,
  SaveOutlined,
  ReloadOutlined,
  GlobalOutlined,
  BellOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import type { ApiKeys, ProxySettings, NotificationEvents } from '../../types';
import {
  getApiKeys,
  updateApiKeys,
  getProxySettings,
  updateProxySettings,
  getNotificationEvents,
  updateNotificationEvents,
  getDefaultApiKeys,
  getDefaultProxySettings,
  getDefaultNotificationEvents,
} from '../../services/apiKeysService';
import './SettingsPage.css';

const { Title, Text } = Typography;

export const SettingsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // API Keys state
  const [apiKeys, setApiKeys] = useState<ApiKeys>(getDefaultApiKeys());
  const [apiKeysForm] = Form.useForm();

  // Proxy settings state
  const [proxySettings, setProxySettings] = useState<ProxySettings>(getDefaultProxySettings());
  const [proxyForm] = Form.useForm();

  // Notification events state
  const [notificationEvents, setNotificationEvents] = useState<NotificationEvents>(getDefaultNotificationEvents());
  const [notificationsForm] = Form.useForm();

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const [keys, proxy, events] = await Promise.all([
        getApiKeys(),
        getProxySettings(),
        getNotificationEvents(),
      ]);

      setApiKeys(keys);
      setProxySettings(proxy);
      setNotificationEvents(events);

      // Set form values
      apiKeysForm.setFieldsValue({
        ipqs_api_key: keys.ipqs.api_key,
        ipqs_enabled: keys.ipqs.enabled,
        telegram_bot_token: keys.telegram.bot_token,
        telegram_chat_id: keys.telegram.chat_id,
        telegram_enabled: keys.telegram.enabled,
      });

      proxyForm.setFieldsValue({
        auto_check_on_add: proxy.auto_check_on_add,
        fraud_score_threshold: proxy.fraud_score_threshold,
        check_interval_hours: proxy.check_interval_hours,
      });

      notificationsForm.setFieldsValue(events);
    } catch (error) {
      console.error('Error loading settings:', error);
      message.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  // Save API Keys
  const handleSaveApiKeys = async (values: any) => {
    setSaving(true);
    try {
      const newApiKeys: ApiKeys = {
        ipqs: {
          api_key: values.ipqs_api_key || '',
          enabled: values.ipqs_enabled,
        },
        telegram: {
          bot_token: values.telegram_bot_token || '',
          chat_id: values.telegram_chat_id || '',
          enabled: values.telegram_enabled,
        },
      };

      await updateApiKeys(newApiKeys);
      setApiKeys(newApiKeys);
      message.success('API keys saved');
    } catch (error) {
      console.error('Error saving API keys:', error);
      message.error('Failed to save API keys');
    } finally {
      setSaving(false);
    }
  };

  // Save Proxy Settings
  const handleSaveProxySettings = async (values: any) => {
    setSaving(true);
    try {
      const newProxySettings: ProxySettings = {
        auto_check_on_add: values.auto_check_on_add,
        fraud_score_threshold: values.fraud_score_threshold,
        check_interval_hours: values.check_interval_hours,
      };

      await updateProxySettings(newProxySettings);
      setProxySettings(newProxySettings);
      message.success('Proxy settings saved');
    } catch (error) {
      console.error('Error saving proxy settings:', error);
      message.error('Failed to save proxy settings');
    } finally {
      setSaving(false);
    }
  };

  // Save Notification Events
  const handleSaveNotifications = async (values: any) => {
    setSaving(true);
    try {
      const newEvents: NotificationEvents = {
        bot_banned: values.bot_banned,
        bot_offline: values.bot_offline,
        bot_online: values.bot_online,
        level_up: values.level_up,
        profession_maxed: values.profession_maxed,
        low_fraud_score: values.low_fraud_score,
        daily_report: values.daily_report,
      };

      await updateNotificationEvents(newEvents);
      setNotificationEvents(newEvents);
      message.success('Notification settings saved');
    } catch (error) {
      console.error('Error saving notification settings:', error);
      message.error('Failed to save notification settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <Title level={4} className="settings-title">
          <ToolOutlined /> Settings
        </Title>
        <Button
          icon={<ReloadOutlined />}
          onClick={loadSettings}
          loading={loading}
        >
          Refresh
        </Button>
      </div>

      <Row gutter={[16, 16]}>
        {/* API Keys Section */}
        <Col span={24}>
          <Card
            title={
              <Space>
                <KeyOutlined />
                <span>API Keys</span>
              </Space>
            }
            className="settings-card"
          >
            <Row gutter={[32, 16]}>
              {/* IPQS */}
              <Col xs={24} lg={12}>
                <Card
                  type="inner"
                  title={
                    <Space>
                      <SafetyOutlined />
                      <span>IPQualityScore</span>
                    </Space>
                  }
                  className="inner-settings-card"
                >
                  <Form
                    form={apiKeysForm}
                    layout="vertical"
                    onFinish={handleSaveApiKeys}
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

              {/* Telegram */}
              <Col xs={24} lg={12}>
                <Card
                  type="inner"
                  title={
                    <Space>
                      <SendOutlined />
                      <span>Telegram Bot</span>
                    </Space>
                  }
                  className="inner-settings-card"
                >
                  <Form
                    form={apiKeysForm}
                    layout="vertical"
                    onFinish={handleSaveApiKeys}
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

        {/* Proxy Settings Section */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <GlobalOutlined />
                <span>Proxy Settings</span>
              </Space>
            }
            className="settings-card"
          >
            <Form
              form={proxyForm}
              layout="vertical"
              onFinish={handleSaveProxySettings}
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
        </Col>

        {/* Notifications Section */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <BellOutlined />
                <span>Notifications</span>
              </Space>
            }
            className="settings-card"
          >
            <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
              Select events to notify via Telegram
            </Text>

            <Form
              form={notificationsForm}
              layout="vertical"
              onFinish={handleSaveNotifications}
              disabled={loading}
            >
              <Row gutter={[16, 8]}>
                <Col span={12}>
                  <Form.Item
                    name="bot_banned"
                    valuePropName="checked"
                    label="Bot Banned"
                  >
                    <Switch />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="bot_offline"
                    valuePropName="checked"
                    label="Bot Offline"
                  >
                    <Switch />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="bot_online"
                    valuePropName="checked"
                    label="Bot Online"
                  >
                    <Switch />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="level_up"
                    valuePropName="checked"
                    label="Level Up"
                  >
                    <Switch />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="profession_maxed"
                    valuePropName="checked"
                    label="Profession Maxed"
                  >
                    <Switch />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="low_fraud_score"
                    valuePropName="checked"
                    label="Low Fraud Score"
                  >
                    <Switch />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="daily_report"
                    valuePropName="checked"
                    label="Daily Report"
                  >
                    <Switch />
                  </Form.Item>
                </Col>
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
      </Row>
    </div>
  );
};

export default SettingsPage;
