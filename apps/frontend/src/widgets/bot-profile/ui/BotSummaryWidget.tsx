import { useList } from '@refinedev/core';
import { message } from 'antd';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { normalizeResourceStatusVocabulary } from '../../../entities/resources/model/statusVocabulary';
import type {
  BotLicense,
  Proxy as ProxyResource,
  Subscription,
} from '../../../entities/resources/model/types';
import { useCurrentTime } from '../../../shared/lib/hooks/useCurrentTime';
import { AppCard as Card, AppFlex as Flex, AppSpin as Spin } from '../../../shared/ui';
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

const RESOURCE_REFETCH_INTERVAL_MS = 7_000;
const RESOURCE_LIST_PAGE_SIZE = 5_000;

export const BotSummaryWidget: React.FC<BotSummaryProps> = ({ bot }) => {
  const [activeSection, setActiveSection] = useState('overview');
  const currentTime = useCurrentTime();
  const licensesList = useList<BotLicense>({
    resource: 'licenses',
    pagination: { mode: 'server', currentPage: 1, pageSize: RESOURCE_LIST_PAGE_SIZE },
    queryOptions: { refetchInterval: RESOURCE_REFETCH_INTERVAL_MS },
  });
  const proxiesList = useList<ProxyResource>({
    resource: 'proxies',
    pagination: { mode: 'server', currentPage: 1, pageSize: RESOURCE_LIST_PAGE_SIZE },
    queryOptions: { refetchInterval: RESOURCE_REFETCH_INTERVAL_MS },
  });
  const subscriptionsList = useList<Subscription>({
    resource: 'subscriptions',
    pagination: { mode: 'server', currentPage: 1, pageSize: RESOURCE_LIST_PAGE_SIZE },
    queryOptions: { refetchInterval: RESOURCE_REFETCH_INTERVAL_MS },
  });
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const resourcesError =
      licensesList.query.error ?? proxiesList.query.error ?? subscriptionsList.query.error;
    if (!resourcesError) {
      return;
    }

    console.error('Failed to load bot summary status info', resourcesError);
    message.error({
      content: 'Failed to load bot summary resources',
      key: 'bot-summary-resources-error',
    });
  }, [licensesList.query.error, proxiesList.query.error, subscriptionsList.query.error]);

  const linkedResources = useMemo<LinkedResources>(() => {
    const licenses = (licensesList.result.data || []) as BotLicense[];
    const proxies = (proxiesList.result.data || []) as ProxyResource[];
    const subscriptions = (subscriptionsList.result.data || []) as Subscription[];
    const linkedLicense = licenses.find((license) => license.bot_ids?.includes(bot.id)) || null;
    const proxyData = proxies.find((proxy) => proxy.bot_id === bot.id);
    const linkedProxy: ProxyDetails | null = proxyData
      ? {
          ip: proxyData.ip,
          port: proxyData.port,
          status: proxyData.status,
          expires_at: proxyData.expires_at,
          provider: proxyData.provider,
          country: proxyData.country,
          computed_status: proxyData.computed_status,
          days_remaining: proxyData.days_remaining,
          is_expiring_soon: proxyData.is_expiring_soon,
        }
      : bot.proxy?.ip
        ? {
            ip: bot.proxy.ip,
            port: bot.proxy.port,
            status: bot.proxy.status,
            expires_at: bot.proxy.expires_at,
            provider: bot.proxy.provider,
            country: bot.proxy.country,
          }
        : null;

    return {
      license: linkedLicense,
      proxy: linkedProxy,
      subscriptions: subscriptions.filter((sub) => sub.bot_id === bot.id),
    };
  }, [
    bot.id,
    bot.proxy,
    licensesList.result.data,
    proxiesList.result.data,
    subscriptionsList.result.data,
  ]);

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

    const lastSeenMinutes = Math.floor((currentTime - bot.last_seen) / (1000 * 60));
    info.isOffline = lastSeenMinutes > 5;
    info.lastSeenMinutes = lastSeenMinutes;

    if (linkedResources.license) {
      const status = normalizeResourceStatusVocabulary(linkedResources.license);
      info.licenseExpired = status.computedStatus === 'expired' || status.statusToken === 'expired';
      info.licenseExpiringSoon = status.isExpiringSoon;
    }

    if (linkedResources.proxy?.expires_at) {
      const status = normalizeResourceStatusVocabulary(linkedResources.proxy);
      info.proxyExpired = status.computedStatus === 'expired' || status.statusToken === 'expired';
      info.proxyExpiringSoon = status.isExpiringSoon;
      info.proxyBanned = linkedResources.proxy.status === 'banned';
    }

    linkedResources.subscriptions.forEach((sub) => {
      const status = normalizeResourceStatusVocabulary(sub);
      if (status.computedStatus === 'expired' || status.statusToken === 'expired') {
        info.subscriptionsExpired += 1;
      } else if (status.isExpiringSoon) {
        info.subscriptionsExpiringSoon += 1;
      }
    });

    return info;
  }, [bot.last_seen, currentTime, linkedResources]);

  const health = getHealthStatus(statusInfo);
  const loading =
    licensesList.query.isLoading ||
    proxiesList.query.isLoading ||
    subscriptionsList.query.isLoading;

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
      <Flex vertical className={styles['bot-summary']}>
        <Card className={styles['summary-loading']}>
          <Spin size="large" />
        </Card>
      </Flex>
    );
  }

  return (
    <Flex vertical className={styles['bot-summary']}>
      <Flex className={styles['bot-subtabs-layout']} align="flex-start" gap={16}>
        <Flex vertical className={styles['bot-subtabs-nav']} gap={2}>
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
        </Flex>

        <Flex vertical className={styles['bot-subtabs-content']}>
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
        </Flex>
      </Flex>
    </Flex>
  );
};
