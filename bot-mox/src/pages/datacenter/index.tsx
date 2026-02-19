import { Spin } from 'antd';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ContentPanel } from '../../components/layout/ContentPanel';
import { useBotsMapQuery } from '../../entities/bot/api/useBotQueries';
import type { BotRecord } from '../../entities/bot/model/types';
import { calculateFinanceSummary } from '../../entities/finance/lib/analytics';
import { useNotesIndexQuery } from '../../entities/notes/api/useNotesIndexQuery';
import type { NoteIndex } from '../../entities/notes/model/types';
import {
  useLicensesQuery,
  useProxiesQuery,
  useSubscriptionsQuery,
} from '../../entities/resources/api/useResourcesQueries';
import { useSubscriptionSettingsQuery } from '../../entities/settings/api/useSubscriptionSettingsQuery';
import { useFinanceOperations } from '../../features/finance/model/useFinanceOperations';
import { uiLogger } from '../../observability/uiLogger';
import type { BotLicense, Proxy as ProxyResource, Subscription } from '../../types';
import { type ContentMapSection, DatacenterContentMap, type ExpiringItem } from './content-map';
import styles from './DatacenterPage.module.css';
import {
  buildProjectStats,
  CONTENT_MAP_COLLAPSE_KEY,
  DEFAULT_COLLAPSED_SECTIONS,
  FINANCE_WINDOW_DAYS,
  MS_PER_DAY,
} from './page-helpers';

function cx(classNames: string): string {
  return classNames
    .split(' ')
    .filter(Boolean)
    .map((name) => styles[name] || name)
    .join(' ');
}

export const DatacenterPage: React.FC = () => {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const botsMapQuery = useBotsMapQuery();
  const licensesQuery = useLicensesQuery();
  const proxiesQuery = useProxiesQuery();
  const subscriptionsQuery = useSubscriptionsQuery();
  const notesIndexQuery = useNotesIndexQuery();
  const subscriptionSettingsQuery = useSubscriptionSettingsQuery();

  const [collapsedSections, setCollapsedSections] = useState<Record<ContentMapSection, boolean>>(
    () => {
      const saved = localStorage.getItem(CONTENT_MAP_COLLAPSE_KEY);
      if (saved) {
        try {
          return { ...DEFAULT_COLLAPSED_SECTIONS, ...JSON.parse(saved) };
        } catch (error) {
          uiLogger.warn('Failed to parse content map collapse state:', error);
        }
      }
      return DEFAULT_COLLAPSED_SECTIONS;
    },
  );

  const { operations, loading: financeLoading } = useFinanceOperations();
  const bots = useMemo<Record<string, BotRecord>>(
    () => (botsMapQuery.data || {}) as Record<string, BotRecord>,
    [botsMapQuery.data],
  );
  const botsLoading = botsMapQuery.isLoading;
  const licenses = useMemo<BotLicense[]>(() => licensesQuery.data || [], [licensesQuery.data]);
  const licensesLoading = licensesQuery.isLoading;
  const proxies = useMemo<ProxyResource[]>(() => proxiesQuery.data || [], [proxiesQuery.data]);
  const proxiesLoading = proxiesQuery.isLoading;
  const subscriptions = useMemo<Subscription[]>(
    () => subscriptionsQuery.data || [],
    [subscriptionsQuery.data],
  );
  const subscriptionsLoading = subscriptionsQuery.isLoading;
  const notesIndex = useMemo<NoteIndex[]>(() => notesIndexQuery.data || [], [notesIndexQuery.data]);
  const notesLoading = notesIndexQuery.isLoading;
  const warningDays = subscriptionSettingsQuery.data?.warning_days || 7;

  useEffect(() => {
    if (!botsMapQuery.error) {
      return;
    }
    uiLogger.error('Error loading bots:', botsMapQuery.error);
  }, [botsMapQuery.error]);
  useEffect(() => {
    if (!licensesQuery.error) return;
    uiLogger.error('Error loading licenses:', licensesQuery.error);
  }, [licensesQuery.error]);
  useEffect(() => {
    if (!proxiesQuery.error) return;
    uiLogger.error('Error loading proxies:', proxiesQuery.error);
  }, [proxiesQuery.error]);
  useEffect(() => {
    if (!subscriptionsQuery.error) return;
    uiLogger.error('Error loading subscriptions:', subscriptionsQuery.error);
  }, [subscriptionsQuery.error]);
  useEffect(() => {
    if (!notesIndexQuery.error) return;
    uiLogger.error('Error loading notes index:', notesIndexQuery.error);
  }, [notesIndexQuery.error]);
  useEffect(() => {
    if (!subscriptionSettingsQuery.error) return;
    uiLogger.error('Error loading subscription settings:', subscriptionSettingsQuery.error);
  }, [subscriptionSettingsQuery.error]);

  useEffect(() => {
    localStorage.setItem(CONTENT_MAP_COLLAPSE_KEY, JSON.stringify(collapsedSections));
  }, [collapsedSections]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const toggleSection = (section: ContentMapSection) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const botsList = useMemo(() => Object.values(bots), [bots]);

  const projectStats = useMemo(() => {
    const tbcBots = botsList.filter((bot) => bot.project_id === 'wow_tbc');
    const midnightBots = botsList.filter((bot) => bot.project_id === 'wow_midnight');

    return {
      all: buildProjectStats(botsList, currentTime),
      wow_tbc: buildProjectStats(tbcBots, currentTime),
      wow_midnight: buildProjectStats(midnightBots, currentTime),
    };
  }, [botsList, currentTime]);

  const financeSummary = useMemo(() => {
    const start = currentTime - FINANCE_WINDOW_DAYS * MS_PER_DAY;
    const windowOps = operations.filter((op) => op.date >= start);
    return calculateFinanceSummary(windowOps);
  }, [operations, currentTime]);

  const financeGoldByProject = useMemo(() => {
    const start = currentTime - FINANCE_WINDOW_DAYS * MS_PER_DAY;

    const seed = {
      wow_tbc: { totalGold: 0, priceSum: 0, priceCount: 0, avgPrice: 0 },
      wow_midnight: { totalGold: 0, priceSum: 0, priceCount: 0, avgPrice: 0 },
    };

    operations.forEach((op) => {
      if (op.date < start) return;
      if (op.type !== 'income' || op.category !== 'sale') return;
      if (!op.project_id) return;
      if (!(op.project_id in seed)) return;

      const projectKey = op.project_id as 'wow_tbc' | 'wow_midnight';
      seed[projectKey].totalGold += op.gold_amount || 0;
      if (typeof op.gold_price_at_time === 'number' && op.gold_price_at_time > 0) {
        seed[projectKey].priceSum += op.gold_price_at_time;
        seed[projectKey].priceCount += 1;
      }
    });

    (Object.keys(seed) as Array<'wow_tbc' | 'wow_midnight'>).forEach((key) => {
      const entry = seed[key];
      entry.avgPrice = entry.priceCount > 0 ? entry.priceSum / entry.priceCount : 0;
    });

    return seed;
  }, [operations, currentTime]);

  const licenseStats = useMemo(() => {
    const expiringSoon = licenses.filter((license) => {
      const daysRemaining = Math.ceil((license.expires_at - currentTime) / MS_PER_DAY);
      return daysRemaining <= warningDays && daysRemaining > 0;
    }).length;

    const expired = licenses.filter((license) => license.expires_at <= currentTime).length;
    const active = licenses.filter(
      (license) => license.status === 'active' && license.expires_at > currentTime,
    ).length;
    const unassigned = licenses.filter(
      (license) => !license.bot_ids || license.bot_ids.length === 0,
    ).length;

    return {
      total: licenses.length,
      active,
      expiringSoon,
      expired,
      unassigned,
    };
  }, [licenses, warningDays, currentTime]);

  const proxyStats = useMemo(() => {
    const expiringSoon = proxies.filter((proxy) => {
      if (proxy.status === 'banned') return false;
      const daysRemaining = Math.ceil((proxy.expires_at - currentTime) / MS_PER_DAY);
      return daysRemaining <= warningDays && daysRemaining > 0;
    }).length;

    const expired = proxies.filter(
      (proxy) => proxy.expires_at <= currentTime || proxy.status === 'expired',
    ).length;
    const active = proxies.filter(
      (proxy) => proxy.status === 'active' && proxy.expires_at > currentTime,
    ).length;
    const unassigned = proxies.filter((proxy) => !proxy.bot_id).length;

    return {
      total: proxies.length,
      active,
      expiringSoon,
      expired,
      unassigned,
    };
  }, [proxies, warningDays, currentTime]);

  const subscriptionStats = useMemo(() => {
    const expiringSoon = subscriptions.filter((sub) => {
      const daysRemaining = Math.ceil((sub.expires_at - currentTime) / MS_PER_DAY);
      return daysRemaining <= warningDays && daysRemaining > 0;
    }).length;

    const expired = subscriptions.filter((sub) => sub.expires_at <= currentTime).length;
    const active = subscriptions.filter((sub) => sub.expires_at > currentTime).length;

    return {
      total: subscriptions.length,
      active,
      expired,
      expiringSoon,
    };
  }, [subscriptions, warningDays, currentTime]);

  const notesStats = useMemo(() => {
    const total = notesIndex.length;
    const pinned = notesIndex.filter((note) => note.is_pinned).length;
    return { total, pinned };
  }, [notesIndex]);

  const latestNotes = useMemo(() => notesIndex.slice(0, 5), [notesIndex]);

  const expiringItems = useMemo(() => {
    const items: ExpiringItem[] = [];

    licenses.forEach((license) => {
      const daysRemaining = Math.ceil((license.expires_at - currentTime) / MS_PER_DAY);
      if (daysRemaining <= warningDays && daysRemaining > 0) {
        const botName = license.bot_ids?.length
          ? bots[license.bot_ids[0]]?.character?.name
          : undefined;
        items.push({
          id: license.id,
          type: 'license',
          name: `License (${license.type})`,
          botName,
          daysRemaining,
          expiresAt: license.expires_at,
        });
      }
    });

    proxies.forEach((proxy) => {
      if (proxy.status === 'banned') return;
      const daysRemaining = Math.ceil((proxy.expires_at - currentTime) / MS_PER_DAY);
      if (daysRemaining <= warningDays && daysRemaining > 0) {
        const botName = proxy.bot_id ? bots[proxy.bot_id]?.character?.name : undefined;
        items.push({
          id: proxy.id,
          type: 'proxy',
          name: `Proxy (${proxy.ip}:${proxy.port})`,
          botName,
          daysRemaining,
          expiresAt: proxy.expires_at,
        });
      }
    });

    subscriptions.forEach((sub) => {
      const daysRemaining = Math.ceil((sub.expires_at - currentTime) / MS_PER_DAY);
      if (daysRemaining <= warningDays && daysRemaining > 0) {
        const botName = sub.bot_id ? bots[sub.bot_id]?.character?.name : undefined;
        items.push({
          id: sub.id,
          type: 'subscription',
          name: `Subscription (${sub.type})`,
          botName,
          daysRemaining,
          expiresAt: sub.expires_at,
        });
      }
    });

    return items.sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [licenses, proxies, subscriptions, bots, warningDays, currentTime]);

  const initialLoading =
    botsLoading &&
    licensesLoading &&
    proxiesLoading &&
    subscriptionsLoading &&
    financeLoading &&
    notesLoading;

  const navProps = (path: string) => ({
    role: 'button' as const,
    tabIndex: 0,
    onClick: () => navigate(path),
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        navigate(path);
      }
    },
  });

  if (initialLoading) {
    return (
      <div className={cx('datacenter-page')}>
        <ContentPanel type="datacenter">
          <div className={cx('loading-container')}>
            <Spin size="large" />
          </div>
        </ContentPanel>
      </div>
    );
  }

  return (
    <div className={cx('datacenter-page')}>
      <ContentPanel type="datacenter">
        <DatacenterContentMap
          collapsedSections={collapsedSections}
          toggleSection={toggleSection}
          navProps={navProps}
          loading={{
            bots: botsLoading,
            licenses: licensesLoading,
            proxies: proxiesLoading,
            subscriptions: subscriptionsLoading,
            finance: financeLoading,
            notes: notesLoading,
          }}
          projectStats={projectStats}
          licenseStats={licenseStats}
          proxyStats={proxyStats}
          subscriptionStats={subscriptionStats}
          financeWindowDays={FINANCE_WINDOW_DAYS}
          financeSummary={financeSummary}
          financeGoldByProject={financeGoldByProject}
          notesStats={notesStats}
          latestNotes={latestNotes}
          expiringItems={expiringItems}
        />
      </ContentPanel>
    </div>
  );
};
