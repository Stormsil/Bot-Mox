import React from 'react';
import { Card, Col, Row, Tag, Typography } from 'antd';
import {
  CalendarOutlined,
  ClockCircleOutlined,
  CreditCardOutlined,
  FlagOutlined,
  GlobalOutlined,
  IdcardOutlined,
  KeyOutlined,
  MailOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { SummaryStatItem } from './stat-item';
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

interface SummaryConfigureSectionProps {
  bot: BotSummaryBot;
  accountComplete: boolean;
  personComplete: boolean;
  accountEmail: string;
  accountPassword: string;
  accountCreatedAt: number;
  scheduleStats: ScheduleStats;
  goToConfigure: (subtab: SummaryConfigureTab) => void;
  onActivate: (action: () => void) => (event: React.KeyboardEvent<HTMLElement>) => void;
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
  onActivate,
  formatDate,
}) => (
  <section id="summary-configure" className="bot-section">
    <Row gutter={[16, 16]} className="details-row">
      <Col span={8}>
        <Card
          title={
            <div className="link-card-title">
              <MailOutlined className="link-card-icon" />
              <span>Account</span>
            </div>
          }
          className="detail-card link-card"
          hoverable
          onClick={() => goToConfigure('account')}
          role="button"
          tabIndex={0}
          onKeyDown={onActivate(() => goToConfigure('account'))}
        >
          <div className="link-card-header">
            <Tag color={accountComplete ? 'success' : 'warning'}>{accountComplete ? 'Complete' : 'Incomplete'}</Tag>
          </div>
          <div className="summary-stats-list">
            <SummaryStatItem
              label="Email"
              value={
                accountEmail ? (
                  <Text copyable={{ text: accountEmail }} className="summary-copy-text">
                    {accountEmail}
                  </Text>
                ) : (
                  <span className="summary-copy-empty">Email not set</span>
                )
              }
              icon={<MailOutlined />}
            />
            <SummaryStatItem
              label="Password"
              value={
                accountPassword ? (
                  <Text copyable={{ text: accountPassword }} className="summary-copy-text">
                    {accountPassword}
                  </Text>
                ) : (
                  <span className="summary-copy-empty">Password not set</span>
                )
              }
              icon={<KeyOutlined />}
              valueClassName="summary-stat-mono"
            />
            {bot.account?.mail_provider && (
              <SummaryStatItem label="Provider" value={bot.account.mail_provider} icon={<GlobalOutlined />} />
            )}
            <SummaryStatItem label="Created" value={accountCreatedAt ? formatDate(accountCreatedAt) : '—'} icon={<CalendarOutlined />} />
          </div>
        </Card>
      </Col>

      <Col span={8}>
        <Card
          title={
            <div className="link-card-title">
              <IdcardOutlined className="link-card-icon" />
              <span>Person</span>
            </div>
          }
          className="detail-card link-card"
          hoverable
          onClick={() => goToConfigure('person')}
          role="button"
          tabIndex={0}
          onKeyDown={onActivate(() => goToConfigure('person'))}
        >
          <div className="link-card-header">
            <Tag color={personComplete ? 'success' : 'warning'}>{personComplete ? 'Complete' : 'Incomplete'}</Tag>
          </div>
          <div className="summary-stats-list">
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
            {bot.person?.birth_date && <SummaryStatItem label="Birth" value={bot.person.birth_date} icon={<CalendarOutlined />} />}
          </div>
        </Card>
      </Col>

      <Col span={8}>
        <Card
          title={
            <div className="link-card-title">
              <CalendarOutlined className="link-card-icon" />
              <span>Schedule</span>
            </div>
          }
          className="detail-card link-card"
          hoverable
          onClick={() => goToConfigure('schedule')}
          role="button"
          tabIndex={0}
          onKeyDown={onActivate(() => goToConfigure('schedule'))}
        >
          <div className="link-card-header">
            <Tag color={scheduleStats.enabledSessions > 0 ? 'success' : undefined}>
              {scheduleStats.enabledSessions > 0 ? 'Configured' : 'Not Set'}
            </Tag>
          </div>
          <div className="summary-stats-list">
            <SummaryStatItem
              label="Active Sessions"
              value={`${scheduleStats.enabledSessions}/${scheduleStats.totalSessions}`}
              icon={<ClockCircleOutlined />}
            />
            <SummaryStatItem label="Days Configured" value={scheduleStats.daysConfigured} icon={<CalendarOutlined />} />
          </div>
        </Card>
      </Col>
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
  <section id="summary-resources" className="bot-section">
    <Card className="status-summary-card" title="Status Summary">
      <Row gutter={[16, 16]}>
        <Col span={8}>
          <div
            className="status-item clickable"
            role="button"
            tabIndex={0}
            onClick={() => goToResources('license')}
            onKeyDown={onActivate(() => goToResources('license'))}
          >
            <KeyOutlined className="status-icon" />
            <div>
              <Text type="secondary">License</Text>
              <br />
              {!linkedResources.license ? (
                <Tag>Not Assigned</Tag>
              ) : statusInfo.licenseExpired ? (
                <Tag color="error">Expired</Tag>
              ) : statusInfo.licenseExpiringSoon ? (
                <Tag color="warning">Expiring Soon</Tag>
              ) : (
                <Tag color="success">Active</Tag>
              )}
              <div className="status-meta">
                <span>Key: {formatCompactKey(linkedResources.license?.key)}</span>
              </div>
              <div className="status-meta">
                <span>Expires: {formatDate(linkedResources.license?.expires_at)}</span>
              </div>
            </div>
          </div>
        </Col>
        <Col span={8}>
          <div
            className="status-item clickable"
            role="button"
            tabIndex={0}
            onClick={() => goToResources('proxy')}
            onKeyDown={onActivate(() => goToResources('proxy'))}
          >
            <GlobalOutlined className="status-icon" />
            <div>
              <Text type="secondary">Proxy</Text>
              <br />
              {!linkedResources.proxy?.ip ? (
                <Tag>Not Assigned</Tag>
              ) : statusInfo.proxyExpired ? (
                <Tag color="error">Expired</Tag>
              ) : statusInfo.proxyBanned ? (
                <Tag color="error">Banned</Tag>
              ) : statusInfo.proxyExpiringSoon ? (
                <Tag color="warning">Expiring Soon</Tag>
              ) : (
                <Tag color="success">Active</Tag>
              )}
              <div className="status-meta">
                <span>
                  IP:{' '}
                  {linkedResources.proxy?.ip
                    ? `${linkedResources.proxy.ip}${linkedResources.proxy.port ? `:${linkedResources.proxy.port}` : ''}`
                    : '—'}
                </span>
              </div>
              <div className="status-meta">
                <span>Expires: {formatDate(linkedResources.proxy?.expires_at)}</span>
              </div>
            </div>
          </div>
        </Col>
        <Col span={8}>
          <div
            className="status-item clickable"
            role="button"
            tabIndex={0}
            onClick={() => goToResources('subscription')}
            onKeyDown={onActivate(() => goToResources('subscription'))}
          >
            <CreditCardOutlined className="status-icon" />
            <div>
              <Text type="secondary">Subscriptions</Text>
              <br />
              {subscriptionSummary.total === 0 ? (
                <Tag>None</Tag>
              ) : statusInfo.subscriptionsExpired > 0 ? (
                <Tag color="error">{statusInfo.subscriptionsExpired} Expired</Tag>
              ) : statusInfo.subscriptionsExpiringSoon > 0 ? (
                <Tag color="warning">{statusInfo.subscriptionsExpiringSoon} Expiring</Tag>
              ) : (
                <Tag color="success">All Active</Tag>
              )}
              <div className="status-meta">
                <span>
                  Active: {subscriptionSummary.activeCount}/{subscriptionSummary.total}
                </span>
              </div>
              <div className="status-meta">
                <span>
                  Next:{' '}
                  {subscriptionSummary.nextExpiry
                    ? `${formatDate(subscriptionSummary.nextExpiry.expires_at)} (${formatDaysLeft(subscriptionSummary.nextExpiry.expires_at)})`
                    : '—'}
                </span>
              </div>
            </div>
          </div>
        </Col>
      </Row>
    </Card>
  </section>
);
