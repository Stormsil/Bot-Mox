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
import { Card, Col, Row, Tag, Typography } from 'antd';
import type React from 'react';
import styles from '../BotSummary.module.css';
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
  const summaryTagStyle: React.CSSProperties = { marginInlineEnd: 0 };

  return (
    <section id="summary-configure" className={styles['bot-section']}>
      <Row gutter={[16, 16]} className={styles['details-row']}>
        <Col span={8}>
          <Card
            title={
              <div className={styles['link-card-title']}>
                <MailOutlined className={styles['link-card-icon']} />
                <span>Account</span>
              </div>
            }
            className={[styles['detail-card'], styles['link-card']].join(' ')}
            styles={detailCardStyles}
            hoverable
            onClick={() => goToConfigure('account')}
            role="button"
            tabIndex={0}
            onKeyDown={onActivate(() => goToConfigure('account'))}
          >
            <div className={styles['link-card-header']}>
              <Tag style={summaryTagStyle} color={accountComplete ? 'success' : 'warning'}>
                {accountComplete ? 'Complete' : 'Incomplete'}
              </Tag>
            </div>
            <div className={styles['summary-stats-list']}>
              <SummaryStatItem
                label="Email"
                value={
                  accountEmail ? (
                    <Text copyable={{ text: accountEmail }} className={styles['summary-copy-text']}>
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
                      copyable={{ text: accountPassword }}
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
            </div>
          </Card>
        </Col>

        <Col span={8}>
          <Card
            title={
              <div className={styles['link-card-title']}>
                <IdcardOutlined className={styles['link-card-icon']} />
                <span>Person</span>
              </div>
            }
            className={[styles['detail-card'], styles['link-card']].join(' ')}
            styles={detailCardStyles}
            hoverable
            onClick={() => goToConfigure('person')}
            role="button"
            tabIndex={0}
            onKeyDown={onActivate(() => goToConfigure('person'))}
          >
            <div className={styles['link-card-header']}>
              <Tag style={summaryTagStyle} color={personComplete ? 'success' : 'warning'}>
                {personComplete ? 'Complete' : 'Incomplete'}
              </Tag>
            </div>
            <div className={styles['summary-stats-list']}>
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
            </div>
          </Card>
        </Col>

        <Col span={8}>
          <Card
            title={
              <div className={styles['link-card-title']}>
                <CalendarOutlined className={styles['link-card-icon']} />
                <span>Schedule</span>
              </div>
            }
            className={[styles['detail-card'], styles['link-card']].join(' ')}
            styles={detailCardStyles}
            hoverable
            onClick={() => goToConfigure('schedule')}
            role="button"
            tabIndex={0}
            onKeyDown={onActivate(() => goToConfigure('schedule'))}
          >
            <div className={styles['link-card-header']}>
              <Tag
                style={summaryTagStyle}
                color={scheduleStats.enabledSessions > 0 ? 'success' : undefined}
              >
                {scheduleStats.enabledSessions > 0 ? 'Configured' : 'Not Set'}
              </Tag>
            </div>
            <div className={styles['summary-stats-list']}>
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
            </div>
          </Card>
        </Col>
      </Row>
    </section>
  );
};

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
}) => {
  const statusSummaryStyles = {
    header: {
      background: 'var(--boxmox-color-surface-muted)',
      borderBottom: '1px solid var(--boxmox-color-border-default)',
    },
  };
  const summaryTagStyle: React.CSSProperties = { marginInlineEnd: 0 };

  return (
    <section id="summary-resources" className={styles['bot-section']}>
      <Card
        className={styles['status-summary-card']}
        title="Status Summary"
        styles={statusSummaryStyles}
      >
        <Row gutter={[16, 16]}>
          <Col span={8}>
            <button
              type="button"
              className={[styles['status-item'], styles.clickable].join(' ')}
              onClick={() => goToResources('license')}
              onKeyDown={onActivate(() => goToResources('license'))}
            >
              <KeyOutlined className={styles['status-icon']} />
              <div>
                <Text type="secondary">License</Text>
                <br />
                {!linkedResources.license ? (
                  <Tag style={summaryTagStyle}>Not Assigned</Tag>
                ) : statusInfo.licenseExpired ? (
                  <Tag style={summaryTagStyle} color="error">
                    Expired
                  </Tag>
                ) : statusInfo.licenseExpiringSoon ? (
                  <Tag style={summaryTagStyle} color="warning">
                    Expiring Soon
                  </Tag>
                ) : (
                  <Tag style={summaryTagStyle} color="success">
                    Active
                  </Tag>
                )}
                <div className={styles['status-meta']}>
                  <span>Key: {formatCompactKey(linkedResources.license?.key)}</span>
                </div>
                <div className={styles['status-meta']}>
                  <span>Expires: {formatDate(linkedResources.license?.expires_at)}</span>
                </div>
              </div>
            </button>
          </Col>
          <Col span={8}>
            <button
              type="button"
              className={[styles['status-item'], styles.clickable].join(' ')}
              onClick={() => goToResources('proxy')}
              onKeyDown={onActivate(() => goToResources('proxy'))}
            >
              <GlobalOutlined className={styles['status-icon']} />
              <div>
                <Text type="secondary">Proxy</Text>
                <br />
                {!linkedResources.proxy?.ip ? (
                  <Tag style={summaryTagStyle}>Not Assigned</Tag>
                ) : statusInfo.proxyExpired ? (
                  <Tag style={summaryTagStyle} color="error">
                    Expired
                  </Tag>
                ) : statusInfo.proxyBanned ? (
                  <Tag style={summaryTagStyle} color="error">
                    Banned
                  </Tag>
                ) : statusInfo.proxyExpiringSoon ? (
                  <Tag style={summaryTagStyle} color="warning">
                    Expiring Soon
                  </Tag>
                ) : (
                  <Tag style={summaryTagStyle} color="success">
                    Active
                  </Tag>
                )}
                <div className={styles['status-meta']}>
                  <span>
                    IP:{' '}
                    {linkedResources.proxy?.ip
                      ? `${linkedResources.proxy.ip}${linkedResources.proxy.port ? `:${linkedResources.proxy.port}` : ''}`
                      : '—'}
                  </span>
                </div>
                <div className={styles['status-meta']}>
                  <span>Expires: {formatDate(linkedResources.proxy?.expires_at)}</span>
                </div>
              </div>
            </button>
          </Col>
          <Col span={8}>
            <button
              type="button"
              className={[styles['status-item'], styles.clickable].join(' ')}
              onClick={() => goToResources('subscription')}
              onKeyDown={onActivate(() => goToResources('subscription'))}
            >
              <CreditCardOutlined className={styles['status-icon']} />
              <div>
                <Text type="secondary">Subscriptions</Text>
                <br />
                {subscriptionSummary.total === 0 ? (
                  <Tag style={summaryTagStyle}>None</Tag>
                ) : statusInfo.subscriptionsExpired > 0 ? (
                  <Tag style={summaryTagStyle} color="error">
                    {statusInfo.subscriptionsExpired} Expired
                  </Tag>
                ) : statusInfo.subscriptionsExpiringSoon > 0 ? (
                  <Tag style={summaryTagStyle} color="warning">
                    {statusInfo.subscriptionsExpiringSoon} Expiring
                  </Tag>
                ) : (
                  <Tag style={summaryTagStyle} color="success">
                    All Active
                  </Tag>
                )}
                <div className={styles['status-meta']}>
                  <span>
                    Active: {subscriptionSummary.activeCount}/{subscriptionSummary.total}
                  </span>
                </div>
                <div className={styles['status-meta']}>
                  <span>
                    Next:{' '}
                    {subscriptionSummary.nextExpiry
                      ? `${formatDate(subscriptionSummary.nextExpiry.expires_at)} (${formatDaysLeft(subscriptionSummary.nextExpiry.expires_at)})`
                      : '—'}
                  </span>
                </div>
              </div>
            </button>
          </Col>
        </Row>
      </Card>
    </section>
  );
};
