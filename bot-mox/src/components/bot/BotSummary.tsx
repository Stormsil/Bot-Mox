import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Typography, Tag, Alert, Spin, Tooltip, Space } from 'antd';
import { 
  WarningOutlined, 
  CheckCircleOutlined, 
  ClockCircleOutlined, 
  ExclamationCircleOutlined,
  KeyOutlined,
  GlobalOutlined,
  CreditCardOutlined,
  PoweroffOutlined
} from '@ant-design/icons';
import { StatusBadge } from '../ui/StatusBadge';
import { ref, onValue } from 'firebase/database';
import { database } from '../../utils/firebase';
import type { Bot, BotLicense, Proxy, Subscription } from '../../types';
import './BotSummary.css';

const { Title, Text } = Typography;

interface BotSummaryProps {
  bot: Bot;
}

interface BotStatusInfo {
  licenseExpired: boolean;
  licenseExpiringSoon: boolean;
  proxyExpired: boolean;
  proxyExpiringSoon: boolean;
  proxyBanned: boolean;
  subscriptionsExpired: number;
  subscriptionsExpiringSoon: number;
  isOffline: boolean;
  lastSeenMinutes: number;
}

export const BotSummary: React.FC<BotSummaryProps> = ({ bot }) => {
  const [statusInfo, setStatusInfo] = useState<BotStatusInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Проверяем статус лицензии
    const licensesRef = ref(database, 'bot_licenses');
    const proxiesRef = ref(database, 'proxies');
    const subscriptionsRef = ref(database, 'subscriptions');
    const botProxyRef = ref(database, `bots/${bot.id}/proxy`);

    const checkStatus = async () => {
      const info: BotStatusInfo = {
        licenseExpired: false,
        licenseExpiringSoon: false,
        proxyExpired: false,
        proxyExpiringSoon: false,
        proxyBanned: false,
        subscriptionsExpired: 0,
        subscriptionsExpiringSoon: 0,
        isOffline: false,
        lastSeenMinutes: 0,
      };

      // Проверка offline статуса
      const lastSeenMinutes = Math.floor((Date.now() - bot.last_seen) / (1000 * 60));
      info.isOffline = lastSeenMinutes > 5;
      info.lastSeenMinutes = lastSeenMinutes;

      // Проверка лицензии (v1.4.0 - поддержка нескольких ботов)
      onValue(licensesRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const license = Object.entries(data).find(([_, value]) => {
            const lic = value as BotLicense;
            return lic.bot_ids?.includes(bot.id);
          });
          if (license) {
            const licData = license[1] as BotLicense;
            const daysRemaining = Math.ceil((licData.expires_at - Date.now()) / (1000 * 60 * 60 * 24));
            info.licenseExpired = Date.now() > licData.expires_at;
            info.licenseExpiringSoon = daysRemaining <= 7 && daysRemaining > 0;
          }
        }
      }, { onlyOnce: true });

      // Проверка прокси (сначала в боте, потом в общем списке)
      onValue(botProxyRef, (snapshot) => {
        const botProxy = snapshot.val();
        if (botProxy && botProxy.ip) {
          const daysRemaining = botProxy.expires_at 
            ? Math.ceil((botProxy.expires_at - Date.now()) / (1000 * 60 * 60 * 24))
            : 0;
          info.proxyExpired = botProxy.expires_at ? Date.now() > botProxy.expires_at : false;
          info.proxyExpiringSoon = daysRemaining <= 7 && daysRemaining > 0;
          info.proxyBanned = botProxy.status === 'banned';
        } else {
          // Проверяем в общем списке
          onValue(proxiesRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
              const proxy = Object.entries(data).find(([_, value]) => {
                const p = value as Proxy;
                return p.bot_id === bot.id;
              });
              if (proxy) {
                const proxyData = proxy[1] as Proxy;
                const daysRemaining = Math.ceil((proxyData.expires_at - Date.now()) / (1000 * 60 * 60 * 24));
                info.proxyExpired = Date.now() > proxyData.expires_at;
                info.proxyExpiringSoon = daysRemaining <= 7 && daysRemaining > 0;
                info.proxyBanned = proxyData.status === 'banned';
              }
            }
          }, { onlyOnce: true });
        }
      }, { onlyOnce: true });

      // Проверка подписок
      onValue(subscriptionsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          Object.entries(data).forEach(([_, value]) => {
            const sub = value as Subscription;
            if (sub.bot_id === bot.id) {
              const daysRemaining = Math.ceil((sub.expires_at - Date.now()) / (1000 * 60 * 60 * 24));
              if (Date.now() > sub.expires_at) {
                info.subscriptionsExpired++;
              } else if (daysRemaining <= 7 && daysRemaining > 0) {
                info.subscriptionsExpiringSoon++;
              }
            }
          });
        }
      }, { onlyOnce: true });

      setTimeout(() => {
        setStatusInfo(info);
        setLoading(false);
      }, 500);
    };

    checkStatus();
  }, [bot.id, bot.last_seen]);

  // Получение общего статуса здоровья бота
  const getHealthStatus = () => {
    if (!statusInfo) return { status: 'unknown', message: 'Checking...', icon: <Spin size="small" /> };
    
    const criticalIssues = [
      statusInfo.licenseExpired,
      statusInfo.proxyExpired,
      statusInfo.proxyBanned,
      statusInfo.subscriptionsExpired > 0,
    ].filter(Boolean).length;

    const warnings = [
      statusInfo.licenseExpiringSoon,
      statusInfo.proxyExpiringSoon,
      statusInfo.subscriptionsExpiringSoon > 0,
      statusInfo.isOffline,
    ].filter(Boolean).length;

    if (criticalIssues > 0) {
      return { 
        status: 'error', 
        message: `${criticalIssues} critical issue(s)`, 
        icon: <ExclamationCircleOutlined /> 
      };
    }
    if (warnings > 0) {
      return { 
        status: 'warning', 
        message: `${warnings} warning(s)`, 
        icon: <WarningOutlined /> 
      };
    }
    return { 
      status: 'success', 
      message: 'All systems operational', 
      icon: <CheckCircleOutlined /> 
    };
  };

  const health = getHealthStatus();

  if (loading) {
    return (
      <div className="bot-summary">
        <Card className="summary-loading">
          <Spin size="large" />
        </Card>
      </div>
    );
  }

  return (
    <div className="bot-summary">
      {/* Health Status Alert */}
      <Alert
        className="health-alert"
        message={
          <Space>
            {health.icon}
            <span>Bot Health: {health.message}</span>
          </Space>
        }
        type={health.status as any}
        showIcon={false}
      />

      {/* Critical Issues */}
      {statusInfo && (
        <div className="alerts-section">
          {statusInfo.licenseExpired && (
            <Alert
              className="status-alert"
              message="License Expired"
              description="The bot license has expired. Bot may stop functioning. Please renew the license."
              type="error"
              showIcon
              icon={<KeyOutlined />}
            />
          )}
          {statusInfo.licenseExpiringSoon && !statusInfo.licenseExpired && (
            <Alert
              className="status-alert"
              message="License Expiring Soon"
              description="The bot license will expire soon. Please renew to avoid interruption."
              type="warning"
              showIcon
              icon={<KeyOutlined />}
            />
          )}
          {statusInfo.proxyExpired && (
            <Alert
              className="status-alert"
              message="Proxy Expired"
              description="The proxy has expired. Bot may lose connection. Please update proxy."
              type="error"
              showIcon
              icon={<GlobalOutlined />}
            />
          )}
          {statusInfo.proxyBanned && (
            <Alert
              className="status-alert"
              message="Proxy Banned"
              description="The proxy has been banned by the game. Please assign a new proxy."
              type="error"
              showIcon
              icon={<GlobalOutlined />}
            />
          )}
          {statusInfo.proxyExpiringSoon && !statusInfo.proxyExpired && !statusInfo.proxyBanned && (
            <Alert
              className="status-alert"
              message="Proxy Expiring Soon"
              description="The proxy will expire soon. Please renew to avoid connection issues."
              type="warning"
              showIcon
              icon={<GlobalOutlined />}
            />
          )}
          {statusInfo.subscriptionsExpired > 0 && (
            <Alert
              className="status-alert"
              message={`${statusInfo.subscriptionsExpired} Subscription(s) Expired`}
              description="Some subscriptions have expired. Check the Subscription tab for details."
              type="error"
              showIcon
              icon={<CreditCardOutlined />}
            />
          )}
          {statusInfo.subscriptionsExpiringSoon > 0 && statusInfo.subscriptionsExpired === 0 && (
            <Alert
              className="status-alert"
              message={`${statusInfo.subscriptionsExpiringSoon} Subscription(s) Expiring Soon`}
              description="Some subscriptions will expire soon. Check the Subscription tab for details."
              type="warning"
              showIcon
              icon={<CreditCardOutlined />}
            />
          )}
          {statusInfo.isOffline && (
            <Alert
              className="status-alert"
              message="Bot Offline"
              description={`Last seen ${statusInfo.lastSeenMinutes} minutes ago. The bot may be disconnected or experiencing issues.`}
              type="warning"
              showIcon
              icon={<PoweroffOutlined />}
            />
          )}
        </div>
      )}

      {/* Заголовок с основной информацией */}
      <Card className="summary-header-card" bordered={false}>
        <div className="summary-header">
          <div className="header-main">
            <Title level={4} className="bot-name">
              {bot.character.name}
              <StatusBadge status={bot.status} />
            </Title>
            <Text className="bot-subtitle">
              {bot.character.race} {bot.character.class} • Level {bot.character.level}
            </Text>
          </div>
          <div className="header-meta">
            <Tag className="server-tag">{bot.character.server}</Tag>
            <Tag className="project-tag">{bot.project_id}</Tag>
          </div>
        </div>
      </Card>

      {/* Детальная информация */}
      <Row gutter={[16, 16]} className="details-row">
        <Col span={12}>
          <Card title="Character Info" className="detail-card">
            <div className="character-stats">
              <div className="stat-row">
                <Text>Level</Text>
                <Text strong>{bot.character.level}</Text>
              </div>
              <div className="stat-row">
                <Text>Race</Text>
                <Text strong className="capitalize">{bot.character.race}</Text>
              </div>
              <div className="stat-row">
                <Text>Class</Text>
                <Text strong className="capitalize">{bot.character.class}</Text>
              </div>
              <div className="stat-row">
                <Text>Server</Text>
                <Tag className="server-tag">{bot.character.server}</Tag>
              </div>
            </div>
          </Card>
        </Col>

        <Col span={12}>
          <Card title="Bot Info" className="detail-card">
            <div className="bot-stats">
              <div className="stat-row">
                <Text>Bot ID</Text>
                <Text strong className="bot-id">{bot.id}</Text>
              </div>
              <div className="stat-row">
                <Text>Project</Text>
                <Tag className="project-tag">{bot.project_id}</Tag>
              </div>
              <div className="stat-row">
                <Text>Status</Text>
                <StatusBadge status={bot.status} size="small" />
              </div>
              <div className="stat-row">
                <Text>Last Seen</Text>
                <Tooltip title={new Date(bot.last_seen).toLocaleString()}>
                  <Text strong className={statusInfo?.isOffline ? 'offline-text' : ''}>
                    {statusInfo?.isOffline 
                      ? `${statusInfo.lastSeenMinutes} min ago` 
                      : new Date(bot.last_seen).toLocaleTimeString()}
                  </Text>
                </Tooltip>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Status Summary */}
      {statusInfo && (
        <Card className="status-summary-card" title="Status Summary">
          <Row gutter={[16, 16]}>
            <Col span={8}>
              <div className="status-item">
                <KeyOutlined className="status-icon" />
                <div>
                  <Text type="secondary">License</Text>
                  <br />
                  {statusInfo.licenseExpired ? (
                    <Tag color="error">Expired</Tag>
                  ) : statusInfo.licenseExpiringSoon ? (
                    <Tag color="warning">Expiring Soon</Tag>
                  ) : (
                    <Tag color="success">Active</Tag>
                  )}
                </div>
              </div>
            </Col>
            <Col span={8}>
              <div className="status-item">
                <GlobalOutlined className="status-icon" />
                <div>
                  <Text type="secondary">Proxy</Text>
                  <br />
                  {statusInfo.proxyExpired ? (
                    <Tag color="error">Expired</Tag>
                  ) : statusInfo.proxyBanned ? (
                    <Tag color="error">Banned</Tag>
                  ) : statusInfo.proxyExpiringSoon ? (
                    <Tag color="warning">Expiring Soon</Tag>
                  ) : (
                    <Tag color="success">Active</Tag>
                  )}
                </div>
              </div>
            </Col>
            <Col span={8}>
              <div className="status-item">
                <CreditCardOutlined className="status-icon" />
                <div>
                  <Text type="secondary">Subscriptions</Text>
                  <br />
                  {statusInfo.subscriptionsExpired > 0 ? (
                    <Tag color="error">{statusInfo.subscriptionsExpired} Expired</Tag>
                  ) : statusInfo.subscriptionsExpiringSoon > 0 ? (
                    <Tag color="warning">{statusInfo.subscriptionsExpiringSoon} Expiring</Tag>
                  ) : (
                    <Tag color="success">All Active</Tag>
                  )}
                </div>
              </div>
            </Col>
          </Row>
        </Card>
      )}
    </div>
  );
};
