import React, { useEffect, useMemo, useState } from 'react';
import { Card, Spin } from 'antd';
import { useSearchParams } from 'react-router-dom';
import type { BotLicense, Proxy, Subscription } from '../../types';
import { fetchResources } from '../../services/resourcesApiService';
import {
  SUMMARY_SECTIONS,
  calculateScheduleStats,
  calculateSubscriptionSummary,
  formatCompactKey,
  formatDate,
  formatDaysLeft,
  formatProjectName,
  getHealthStatus,
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
import './BotSummary.css';

export const BotSummary: React.FC<BotSummaryProps> = ({ bot }) => {
  const [activeSection, setActiveSection] = useState('overview');
  const [statusInfo, setStatusInfo] = useState<BotStatusInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [linkedResources, setLinkedResources] = useState<LinkedResources>({
    license: null,
    proxy: null,
    subscriptions: [],
  });
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    let isCancelled = false;

    const checkStatus = async () => {
      setLoading(true);
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
      const lastSeenMinutes = Math.floor((Date.now() - bot.last_seen) / (1000 * 60));
      info.isOffline = lastSeenMinutes > 5;
      info.lastSeenMinutes = lastSeenMinutes;

      try {
        const [licenses, proxies, subscriptions] = await Promise.all([
          fetchResources<BotLicense>('licenses'),
          fetchResources<Proxy>('proxies'),
          fetchResources<Subscription>('subscriptions'),
        ]);

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

        if (linkedLicense) {
          const daysRemaining = Math.ceil((linkedLicense.expires_at - Date.now()) / (1000 * 60 * 60 * 24));
          info.licenseExpired = Date.now() > linkedLicense.expires_at;
          info.licenseExpiringSoon = daysRemaining <= warningDays && daysRemaining > 0;
        }

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

        if (linkedProxy?.expires_at) {
          const daysRemaining = Math.ceil((linkedProxy.expires_at - Date.now()) / (1000 * 60 * 60 * 24));
          info.proxyExpired = Date.now() > linkedProxy.expires_at;
          info.proxyExpiringSoon = daysRemaining <= warningDays && daysRemaining > 0;
          info.proxyBanned = linkedProxy.status === 'banned';
        }

        const linkedSubscriptions = subscriptions.filter((sub) => sub.bot_id === bot.id);
        linkedSubscriptions.forEach((sub) => {
          const daysRemaining = Math.ceil((sub.expires_at - Date.now()) / (1000 * 60 * 60 * 24));
          if (Date.now() > sub.expires_at) {
            info.subscriptionsExpired += 1;
          } else if (daysRemaining <= warningDays && daysRemaining > 0) {
            info.subscriptionsExpiringSoon += 1;
          }
        });

        if (!isCancelled) {
          setLinkedResources({
            license: linkedLicense,
            proxy: linkedProxy,
            subscriptions: linkedSubscriptions,
          });
          setStatusInfo(info);
        }
      } catch (error) {
        console.error('Failed to load bot summary status info', error);
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    void checkStatus();
    return () => {
      isCancelled = true;
    };
  }, [bot.id, bot.last_seen, bot.proxy]);

  const health = getHealthStatus(statusInfo);

  const handleSummaryNavClick = (key: string) => {
    setActiveSection(key);
    const element = document.getElementById(`summary-${key}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const setTabParams = (main: SummaryMainTab, subtab?: SummaryConfigureTab | SummaryResourcesTab) => {
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

  const handleKeyActivate =
    (action: () => void) =>
    (event: React.KeyboardEvent<HTMLElement>) => {
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
      bot.person?.zip?.trim()
  );

  const scheduleStats = useMemo(() => calculateScheduleStats(bot.schedule), [bot.schedule]);
  const subscriptionSummary = useMemo(
    () => calculateSubscriptionSummary(linkedResources.subscriptions),
    [linkedResources.subscriptions]
  );

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
      <div className="bot-subtabs-layout">
        <div className="bot-subtabs-nav">
          {SUMMARY_SECTIONS.map((section) => (
            <button
              key={section.key}
              type="button"
              className={`bot-subtab ${activeSection === section.key ? 'active' : ''}`}
              onClick={() => handleSummaryNavClick(section.key)}
            >
              <span className="bot-subtab-icon">{section.icon}</span>
              <span className="bot-subtab-label">{section.label}</span>
            </button>
          ))}
        </div>

        <div className="bot-subtabs-content">
          <SummaryOverviewSection health={health} statusInfo={statusInfo} />
          <SummaryCharacterSection bot={bot} />
          <SummaryBotInfoSection bot={bot} statusInfo={statusInfo} formatProjectName={formatProjectName} />
          <SummaryConfigureSection
            bot={bot}
            accountComplete={accountComplete}
            personComplete={personComplete}
            accountEmail={accountEmail}
            accountPassword={accountPassword}
            accountCreatedAt={accountCreatedAt}
            scheduleStats={scheduleStats}
            goToConfigure={goToConfigure}
            onActivate={handleKeyActivate}
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
