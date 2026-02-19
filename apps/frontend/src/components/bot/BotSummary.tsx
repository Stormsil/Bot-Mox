import { Card, message, Spin } from 'antd';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  useLicensesQuery,
  useProxiesQuery,
  useSubscriptionsQuery,
} from '../../entities/resources/api/useResourcesQueries';
import type { BotLicense, Proxy as ProxyResource, Subscription } from '../../types';
import styles from './BotSummary.module.css';
import {
  calculateScheduleStats,
  calculateSubscriptionSummary,
  formatCompactKey,
  formatDate,
  formatDaysLeft,
  formatProjectName,
  getHealthStatus,
  SUMMARY_SECTIONS,
} from './summary/helpers';
import {
  SummaryBotInfoSection,
  SummaryCharacterSection,
  SummaryConfigureSection,
  SummaryOverviewSection,
  SummaryResourcesSection,
} from './summary/sections';
import type {
  BotStatusInfo,
  BotSummaryProps,
  LinkedResources,
  ProxyDetails,
  SummaryConfigureTab,
  SummaryMainTab,
  SummaryResourcesTab,
} from './summary/types';

export const BotSummary: React.FC<BotSummaryProps> = ({ bot }) => {
  const [activeSection, setActiveSection] = useState('overview');
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const licensesQuery = useLicensesQuery();
  const proxiesQuery = useProxiesQuery();
  const subscriptionsQuery = useSubscriptionsQuery();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const resourcesError = licensesQuery.error ?? proxiesQuery.error ?? subscriptionsQuery.error;
    if (!resourcesError) {
      return;
    }

    console.error('Failed to load bot summary status info', resourcesError);
    message.error({
      content: 'Failed to load bot summary resources',
      key: 'bot-summary-resources-error',
    });
  }, [licensesQuery.error, proxiesQuery.error, subscriptionsQuery.error]);

  const linkedResources = useMemo<LinkedResources>(() => {
    const licenses = (licensesQuery.data || []) as BotLicense[];
    const proxies = (proxiesQuery.data || []) as ProxyResource[];
    const subscriptions = (subscriptionsQuery.data || []) as Subscription[];
    const linkedLicense = licenses.find((license) => license.bot_ids?.includes(bot.id)) || null;
    let linkedProxy: ProxyDetails | null = bot.proxy?.ip
      ? {
          ip: bot.proxy.ip,
          port: bot.proxy.port,
          status: bot.proxy.status,
          expires_at: bot.proxy.expires_at,
          provider: bot.proxy.provider,
          country: bot.proxy.country,
        }
      : null;

    if (!linkedProxy) {
      const proxyData = proxies.find((proxy) => proxy.bot_id === bot.id);
      if (proxyData) {
        linkedProxy = {
          ip: proxyData.ip,
          port: proxyData.port,
          status: proxyData.status,
          expires_at: proxyData.expires_at,
          provider: proxyData.provider,
          country: proxyData.country,
        };
      }
    }

    return {
      license: linkedLicense,
      proxy: linkedProxy,
      subscriptions: subscriptions.filter((sub) => sub.bot_id === bot.id),
    };
  }, [bot.id, bot.proxy, licensesQuery.data, proxiesQuery.data, subscriptionsQuery.data]);

  const statusInfo = useMemo<BotStatusInfo>(() => {
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

    const warningDays = 7;
    const lastSeenMinutes = Math.floor((currentTime - bot.last_seen) / (1000 * 60));
    info.isOffline = lastSeenMinutes > 5;
    info.lastSeenMinutes = lastSeenMinutes;

    if (linkedResources.license) {
      const daysRemaining = Math.ceil(
        (linkedResources.license.expires_at - currentTime) / (1000 * 60 * 60 * 24),
      );
      info.licenseExpired = currentTime > linkedResources.license.expires_at;
      info.licenseExpiringSoon = daysRemaining <= warningDays && daysRemaining > 0;
    }

    if (linkedResources.proxy?.expires_at) {
      const daysRemaining = Math.ceil(
        (linkedResources.proxy.expires_at - currentTime) / (1000 * 60 * 60 * 24),
      );
      info.proxyExpired = currentTime > linkedResources.proxy.expires_at;
      info.proxyExpiringSoon = daysRemaining <= warningDays && daysRemaining > 0;
      info.proxyBanned = linkedResources.proxy.status === 'banned';
    }

    linkedResources.subscriptions.forEach((sub) => {
      const daysRemaining = Math.ceil((sub.expires_at - currentTime) / (1000 * 60 * 60 * 24));
      if (currentTime > sub.expires_at) {
        info.subscriptionsExpired += 1;
      } else if (daysRemaining <= warningDays && daysRemaining > 0) {
        info.subscriptionsExpiringSoon += 1;
      }
    });

    return info;
  }, [bot.last_seen, currentTime, linkedResources]);

  const health = getHealthStatus(statusInfo);
  const loading = licensesQuery.isLoading || proxiesQuery.isLoading || subscriptionsQuery.isLoading;

  const handleSummaryNavClick = (key: string) => {
    setActiveSection(key);
    const element = document.getElementById(`summary-${key}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const setTabParams = (
    main: SummaryMainTab,
    subtab?: SummaryConfigureTab | SummaryResourcesTab,
  ) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', main);
    if (subtab) {
      nextParams.set('subtab', subtab);
    } else {
      nextParams.delete('subtab');
    }
    setSearchParams(nextParams, { replace: true });
  };

  const goToConfigure = (subtab: SummaryConfigureTab) => setTabParams('configure', subtab);
  const goToResources = (subtab: SummaryResourcesTab) => setTabParams('resources', subtab);

  const handleKeyActivate = (action: () => void) => (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action();
    }
  };

  const accountCreatedAt = bot.account?.bnet_created_at || bot.account?.mail_created_at || 0;
  const accountEmail = bot.account?.email?.trim() || '';
  const accountPassword = bot.account?.password?.trim() || '';
  const accountComplete = Boolean(accountEmail && accountPassword);
  const personComplete = Boolean(
    bot.person?.first_name?.trim() &&
      bot.person?.last_name?.trim() &&
      bot.person?.birth_date?.trim() &&
      bot.person?.country?.trim() &&
      bot.person?.city?.trim() &&
      bot.person?.address?.trim() &&
      bot.person?.zip?.trim(),
  );

  const scheduleStats = useMemo(() => calculateScheduleStats(bot.schedule), [bot.schedule]);
  const subscriptionSummary = useMemo(
    () => calculateSubscriptionSummary(linkedResources.subscriptions),
    [linkedResources.subscriptions],
  );

  if (loading) {
    return (
      <div className={styles['bot-summary']}>
        <Card className={styles['summary-loading']}>
          <Spin size="large" />
        </Card>
      </div>
    );
  }

  return (
    <div className={styles['bot-summary']}>
      <div className={styles['bot-subtabs-layout']}>
        <div className={styles['bot-subtabs-nav']}>
          {SUMMARY_SECTIONS.map((section) => (
            <button
              key={section.key}
              type="button"
              className={[styles['bot-subtab'], activeSection === section.key ? styles.active : '']
                .filter(Boolean)
                .join(' ')}
              onClick={() => handleSummaryNavClick(section.key)}
            >
              <span className={styles['bot-subtab-icon']}>{section.icon}</span>
              <span className={styles['bot-subtab-label']}>{section.label}</span>
            </button>
          ))}
        </div>

        <div className={styles['bot-subtabs-content']}>
          <SummaryOverviewSection health={health} statusInfo={statusInfo} />
          <SummaryCharacterSection bot={bot} />
          <SummaryBotInfoSection
            bot={bot}
            statusInfo={statusInfo}
            formatProjectName={formatProjectName}
          />
          <SummaryConfigureSection
            bot={bot}
            accountComplete={accountComplete}
            personComplete={personComplete}
            accountEmail={accountEmail}
            accountPassword={accountPassword}
            accountCreatedAt={accountCreatedAt}
            scheduleStats={scheduleStats}
            goToConfigure={goToConfigure}
            formatDate={formatDate}
          />
          {statusInfo && (
            <SummaryResourcesSection
              statusInfo={statusInfo}
              linkedResources={linkedResources}
              subscriptionSummary={subscriptionSummary}
              goToResources={goToResources}
              onActivate={handleKeyActivate}
              formatCompactKey={formatCompactKey}
              formatDate={formatDate}
              formatDaysLeft={formatDaysLeft}
            />
          )}
        </div>
      </div>
    </div>
  );
};
