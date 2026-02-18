import React from 'react';
import { Alert, Card, Col, Row, Space, Tag, Tooltip } from 'antd';
import {
  ClockCircleOutlined,
  CreditCardOutlined,
  DesktopOutlined,
  FlagOutlined,
  GlobalOutlined,
  IdcardOutlined,
  KeyOutlined,
  PoweroffOutlined,
} from '@ant-design/icons';
import { StatusBadge } from '../../ui/StatusBadge';
import { BotCharacter } from '../BotCharacter';
import { SummaryStatItem } from './stat-item';
import type { BotStatusInfo, BotSummaryBot, HealthStatus } from './types';
import styles from '../BotSummary.module.css';

interface SummaryOverviewSectionProps {
  health: HealthStatus;
  statusInfo: BotStatusInfo | null;
}

export const SummaryOverviewSection: React.FC<SummaryOverviewSectionProps> = ({ health, statusInfo }) => (
  <section id="summary-overview" className={styles['bot-section']}>
    <Alert
      className={styles['health-alert']}
      message={
        <Space>
          {health.icon}
          <span>Bot Health: {health.message}</span>
        </Space>
      }
      type={health.status}
      showIcon={false}
    />

    {statusInfo && (
      <div className={styles['alerts-section']}>
        {statusInfo.licenseExpired && (
          <Alert
            className={styles['status-alert']}
            message="License Expired"
            description="The bot license has expired. Bot may stop functioning. Please renew the license."
            type="error"
            showIcon
            icon={<KeyOutlined />}
          />
        )}
        {statusInfo.licenseExpiringSoon && !statusInfo.licenseExpired && (
          <Alert
            className={styles['status-alert']}
            message="License Expiring Soon"
            description="The bot license will expire soon. Please renew to avoid interruption."
            type="warning"
            showIcon
            icon={<KeyOutlined />}
          />
        )}
        {statusInfo.proxyExpired && (
          <Alert
            className={styles['status-alert']}
            message="Proxy Expired"
            description="The proxy has expired. Bot may lose connection. Please update proxy."
            type="error"
            showIcon
            icon={<GlobalOutlined />}
          />
        )}
        {statusInfo.proxyBanned && (
          <Alert
            className={styles['status-alert']}
            message="Proxy Banned"
            description="The proxy has been banned by the game. Please assign a new proxy."
            type="error"
            showIcon
            icon={<GlobalOutlined />}
          />
        )}
        {statusInfo.proxyExpiringSoon && !statusInfo.proxyExpired && !statusInfo.proxyBanned && (
          <Alert
            className={styles['status-alert']}
            message="Proxy Expiring Soon"
            description="The proxy will expire soon. Please renew to avoid connection issues."
            type="warning"
            showIcon
            icon={<GlobalOutlined />}
          />
        )}
        {statusInfo.subscriptionsExpired > 0 && (
          <Alert
            className={styles['status-alert']}
            message={`${statusInfo.subscriptionsExpired} Subscription(s) Expired`}
            description="Some subscriptions have expired. Check the Subscription tab for details."
            type="error"
            showIcon
            icon={<CreditCardOutlined />}
          />
        )}
        {statusInfo.subscriptionsExpiringSoon > 0 && statusInfo.subscriptionsExpired === 0 && (
          <Alert
            className={styles['status-alert']}
            message={`${statusInfo.subscriptionsExpiringSoon} Subscription(s) Expiring Soon`}
            description="Some subscriptions will expire soon. Check the Subscription tab for details."
            type="warning"
            showIcon
            icon={<CreditCardOutlined />}
          />
        )}
        {statusInfo.isOffline && (
          <Alert
            className={styles['status-alert']}
            message="Bot Offline"
            description={`Last seen ${statusInfo.lastSeenMinutes} minutes ago. The bot may be disconnected or experiencing issues.`}
            type="warning"
            showIcon
            icon={<PoweroffOutlined />}
          />
        )}
      </div>
    )}
  </section>
);

export const SummaryCharacterSection: React.FC<{ bot: BotSummaryBot }> = ({ bot }) => (
  <section id="summary-character" className={styles['bot-section']}>
    <Row gutter={[16, 16]} className={styles['details-row']}>
      <Col span={24}>
        <BotCharacter bot={bot} mode="view" />
      </Col>
    </Row>
  </section>
);

interface SummaryBotInfoSectionProps {
  bot: BotSummaryBot;
  statusInfo: BotStatusInfo | null;
  formatProjectName: (projectId: BotSummaryBot['project_id']) => string;
}

export const SummaryBotInfoSection: React.FC<SummaryBotInfoSectionProps> = ({
  bot,
  statusInfo,
  formatProjectName,
}) => {
  const detailCardStyles = {
    header: {
      background: 'var(--boxmox-color-surface-muted)',
      borderBottom: '1px solid var(--boxmox-color-border-default)',
      padding: '12px 16px',
      minHeight: 'auto',
    },
    body: { padding: 16 },
  };

  return (
  <section id="summary-bot" className={styles['bot-section']}>
    <Row gutter={[16, 16]} className={styles['details-row']}>
      <Col span={24}>
        <Card title="Bot Info" className={styles['detail-card']} styles={detailCardStyles}>
          <div className={styles['summary-stats-grid']}>
            <SummaryStatItem
              label="Bot ID"
              value={bot.id}
              icon={<IdcardOutlined />}
              valueClassName={styles['summary-stat-mono']}
            />
            <SummaryStatItem
              label="Project"
              value={<Tag className={styles['project-tag']}>{formatProjectName(bot.project_id)}</Tag>}
              icon={<FlagOutlined />}
            />
            <SummaryStatItem label="Status" value={<StatusBadge status={bot.status} size="small" />} icon={<PoweroffOutlined />} />
            {(bot.vm?.name || bot.vm?.ip) && (
              <SummaryStatItem
                label="VM"
                value={
                  <span>
                    {bot.vm?.name || 'VM'}
                    {bot.vm?.ip ? ` • ${bot.vm.ip}` : ''}
                  </span>
                }
                icon={<DesktopOutlined />}
              />
            )}
            <SummaryStatItem
              label="Last Seen"
              value={
                <Tooltip title={new Date(bot.last_seen).toLocaleString()}>
                  <span className={statusInfo?.isOffline ? styles['offline-text'] : ''}>
                    {statusInfo?.isOffline ? `${statusInfo.lastSeenMinutes} min ago` : new Date(bot.last_seen).toLocaleTimeString()}
                  </span>
                </Tooltip>
              }
              icon={<ClockCircleOutlined />}
            />
          </div>
        </Card>
      </Col>
    </Row>
  </section>
  );
};
