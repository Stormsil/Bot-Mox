import {
  CalendarOutlined,
  CheckOutlined,
  ClockCircleOutlined,
  CopyOutlined,
  CreditCardOutlined,
  FlagOutlined,
  GlobalOutlined,
  IdcardOutlined,
  KeyOutlined,
  MailOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Card, Row, Tag, Typography } from 'antd';
import type React from 'react';
import styles from '../BotSummary.module.css';
import { ResourceStatusCard } from './ResourceStatusCard';
import { SummaryConfigureLinkCard } from './SummaryConfigureLinkCard';
import { SummaryStatItem } from './stat-item';
import { statusSummaryCardStyles } from './summaryUi';
import type {
  BotStatusInfo,
  BotSummaryBot,
  LinkedResources,
  ScheduleStats,
  SubscriptionSummary,
  SummaryConfigureTab,
  SummaryResourcesTab,
} from './types';

const { Text } = Typography;
const copyableIcons = [
  <CopyOutlined key="copy" className={styles['summary-copy-icon']} />,
  <CheckOutlined key="check" className={styles['summary-copy-icon']} />,
];

interface SummaryConfigureSectionProps {
  bot: BotSummaryBot;
  accountComplete: boolean;
  personComplete: boolean;
  accountEmail: string;
  accountPassword: string;
  accountCreatedAt: number;
  scheduleStats: ScheduleStats;
  goToConfigure: (subtab: SummaryConfigureTab) => void;
  formatDate: (timestamp?: number) => string;
}

export const SummaryConfigureSection: React.FC<SummaryConfigureSectionProps> = ({
  bot,
  accountComplete,
  personComplete,
  accountEmail,
  accountPassword,
  accountCreatedAt,
  scheduleStats,
  goToConfigure,
  formatDate,
}) => (
  <section id="summary-configure" className={styles['bot-section']}>
    <Row gutter={[16, 16]} className={styles['details-row']}>
      <SummaryConfigureLinkCard
        icon={<MailOutlined />}
        title="Account"
        statusTag={
          <Tag color={accountComplete ? 'success' : 'warning'}>
            {accountComplete ? 'Complete' : 'Incomplete'}
          </Tag>
        }
        onOpen={() => goToConfigure('account')}
      >
        <SummaryStatItem
          label="Email"
          value={
            accountEmail ? (
              <Text
                copyable={{ text: accountEmail, icon: copyableIcons }}
                className={styles['summary-copy-text']}
              >
                {accountEmail}
              </Text>
            ) : (
              <span className={styles['summary-copy-empty']}>Email not set</span>
            )
          }
          icon={<MailOutlined />}
        />
        <SummaryStatItem
          label="Password"
          value={
            accountPassword ? (
              <Text
                copyable={{ text: accountPassword, icon: copyableIcons }}
                className={styles['summary-copy-text']}
              >
                {accountPassword}
              </Text>
            ) : (
              <span className={styles['summary-copy-empty']}>Password not set</span>
            )
          }
          icon={<KeyOutlined />}
          valueClassName={styles['summary-stat-mono']}
        />
        {bot.account?.mail_provider && (
          <SummaryStatItem
            label="Provider"
            value={bot.account.mail_provider}
            icon={<GlobalOutlined />}
          />
        )}
        <SummaryStatItem
          label="Created"
          value={accountCreatedAt ? formatDate(accountCreatedAt) : '—'}
          icon={<CalendarOutlined />}
        />
      </SummaryConfigureLinkCard>

      <SummaryConfigureLinkCard
        icon={<IdcardOutlined />}
        title="Person"
        statusTag={
          <Tag color={personComplete ? 'success' : 'warning'}>
            {personComplete ? 'Complete' : 'Incomplete'}
          </Tag>
        }
        onOpen={() => goToConfigure('person')}
      >
        <SummaryStatItem
          label="Name"
          value={
            bot.person?.first_name || bot.person?.last_name
              ? `${bot.person?.first_name || ''} ${bot.person?.last_name || ''}`.trim()
              : 'Name not set'
          }
          icon={<UserOutlined />}
        />
        <SummaryStatItem
          label="Location"
          value={
            bot.person?.country || bot.person?.city
              ? `${bot.person?.country || ''}${bot.person?.city ? `, ${bot.person.city}` : ''}`
              : 'Location not set'
          }
          icon={<FlagOutlined />}
        />
        {bot.person?.birth_date && (
          <SummaryStatItem
            label="Birth"
            value={bot.person.birth_date}
            icon={<CalendarOutlined />}
          />
        )}
      </SummaryConfigureLinkCard>

      <SummaryConfigureLinkCard
        icon={<CalendarOutlined />}
        title="Schedule"
        statusTag={
          <Tag color={scheduleStats.enabledSessions > 0 ? 'success' : undefined}>
            {scheduleStats.enabledSessions > 0 ? 'Configured' : 'Not Set'}
          </Tag>
        }
        onOpen={() => goToConfigure('schedule')}
      >
        <SummaryStatItem
          label="Active Sessions"
          value={`${scheduleStats.enabledSessions}/${scheduleStats.totalSessions}`}
          icon={<ClockCircleOutlined />}
        />
        <SummaryStatItem
          label="Days Configured"
          value={scheduleStats.daysConfigured}
          icon={<CalendarOutlined />}
        />
      </SummaryConfigureLinkCard>
    </Row>
  </section>
);

interface SummaryResourcesSectionProps {
  statusInfo: BotStatusInfo;
  linkedResources: LinkedResources;
  subscriptionSummary: SubscriptionSummary;
  goToResources: (subtab: SummaryResourcesTab) => void;
  onActivate: (action: () => void) => (event: React.KeyboardEvent<HTMLElement>) => void;
  formatCompactKey: (value?: string) => string;
  formatDate: (timestamp?: number) => string;
  formatDaysLeft: (timestamp?: number) => string;
}

export const SummaryResourcesSection: React.FC<SummaryResourcesSectionProps> = ({
  statusInfo,
  linkedResources,
  subscriptionSummary,
  goToResources,
  onActivate,
  formatCompactKey,
  formatDate,
  formatDaysLeft,
}) => (
  <section id="summary-resources" className={styles['bot-section']}>
    <Card
      className={styles['status-summary-card']}
      title={<span className={styles['detail-card-title']}>Status Summary</span>}
      styles={statusSummaryCardStyles}
    >
      <Row gutter={[16, 16]}>
        <ResourceStatusCard
          icon={<KeyOutlined />}
          title="License"
          statusTag={
            !linkedResources.license ? (
              <Tag>Not Assigned</Tag>
            ) : statusInfo.licenseExpired ? (
              <Tag color="error">Expired</Tag>
            ) : statusInfo.licenseExpiringSoon ? (
              <Tag color="warning">Expiring Soon</Tag>
            ) : (
              <Tag color="success">Active</Tag>
            )
          }
          metaRows={[
            {
              key: 'license-key',
              content: <span>Key: {formatCompactKey(linkedResources.license?.key)}</span>,
            },
            {
              key: 'license-expires',
              content: <span>Expires: {formatDate(linkedResources.license?.expires_at)}</span>,
            },
          ]}
          onClick={() => goToResources('license')}
          onKeyDown={onActivate(() => goToResources('license'))}
        />
        <ResourceStatusCard
          icon={<GlobalOutlined />}
          title="Proxy"
          statusTag={
            !linkedResources.proxy?.ip ? (
              <Tag>Not Assigned</Tag>
            ) : statusInfo.proxyExpired ? (
              <Tag color="error">Expired</Tag>
            ) : statusInfo.proxyBanned ? (
              <Tag color="error">Banned</Tag>
            ) : statusInfo.proxyExpiringSoon ? (
              <Tag color="warning">Expiring Soon</Tag>
            ) : (
              <Tag color="success">Active</Tag>
            )
          }
          metaRows={[
            {
              key: 'proxy-ip',
              content: (
                <span>
                  IP:{' '}
                  {linkedResources.proxy?.ip
                    ? `${linkedResources.proxy.ip}${linkedResources.proxy.port ? `:${linkedResources.proxy.port}` : ''}`
                    : '—'}
                </span>
              ),
            },
            {
              key: 'proxy-expires',
              content: <span>Expires: {formatDate(linkedResources.proxy?.expires_at)}</span>,
            },
          ]}
          onClick={() => goToResources('proxy')}
          onKeyDown={onActivate(() => goToResources('proxy'))}
        />
        <ResourceStatusCard
          icon={<CreditCardOutlined />}
          title="Subscriptions"
          statusTag={
            subscriptionSummary.total === 0 ? (
              <Tag>None</Tag>
            ) : statusInfo.subscriptionsExpired > 0 ? (
              <Tag color="error">{statusInfo.subscriptionsExpired} Expired</Tag>
            ) : statusInfo.subscriptionsExpiringSoon > 0 ? (
              <Tag color="warning">{statusInfo.subscriptionsExpiringSoon} Expiring</Tag>
            ) : (
              <Tag color="success">All Active</Tag>
            )
          }
          metaRows={[
            {
              key: 'subscriptions-active',
              content: (
                <span>
                  Active: {subscriptionSummary.activeCount}/{subscriptionSummary.total}
                </span>
              ),
            },
            {
              key: 'subscriptions-next',
              content: (
                <span>
                  Next:{' '}
                  {subscriptionSummary.nextExpiry
                    ? `${formatDate(subscriptionSummary.nextExpiry.expires_at)} (${formatDaysLeft(subscriptionSummary.nextExpiry.expires_at)})`
                    : '—'}
                </span>
              ),
            },
          ]}
          onClick={() => goToResources('subscription')}
          onKeyDown={onActivate(() => goToResources('subscription'))}
        />
      </Row>
    </Card>
  </section>
);
