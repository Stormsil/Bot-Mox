import { useList } from '@refinedev/core';
import { useQuery } from '@tanstack/react-query';

import type React from 'react';
import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBotsMapQuery } from '../../entities/bot/api/useBotQueries';
import type { BotRecord } from '../../entities/bot/model/types';
import { useNotesIndexQuery } from '../../entities/notes/api/useNotesIndexQuery';
import type { NoteIndex } from '../../entities/notes/model/types';
import type {
  BotLicense,
  Proxy as ProxyResource,
  Subscription,
} from '../../entities/resources/model/types';
import { useSubscriptionSettingsQuery } from '../../entities/settings/api/useSubscriptionSettingsQuery';
import { uiLogger } from '../../observability/uiLogger';
import {
  getFinanceProjectPerformanceViaContract,
  getFinanceSummaryViaContract,
} from '../../shared/api/providers/finance-contract-client';
import { AppSpin as Spin } from '../../shared/ui';
import { ContentPanel } from '../../widgets/layout/ContentPanel';
import { DatacenterContentMap, type ExpiringItem } from './content-map';
import { cx } from './datacenterUi';
import { buildProjectStats, FINANCE_WINDOW_DAYS, MS_PER_DAY } from './page-helpers';
import { useDatacenterCollapsedSections, useDatacenterCurrentTime } from './useDatacenterState';

const FINANCE_REFETCH_INTERVAL_MS = 4_000;
const RESOURCE_REFETCH_INTERVAL_MS = 7_000;
const RESOURCE_LIST_PAGE_SIZE = 5_000;

export const DatacenterPage: React.FC = () => {
  const navigate = useNavigate();
  const currentTime = useDatacenterCurrentTime();
  const botsMapQuery = useBotsMapQuery();
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
  const notesIndexQuery = useNotesIndexQuery();
  const subscriptionSettingsQuery = useSubscriptionSettingsQuery();

  const { collapsedSections, toggleSection } = useDatacenterCollapsedSections();

  const financeAggregateQuery = useMemo(
    () => ({
      from_ts: currentTime - FINANCE_WINDOW_DAYS * MS_PER_DAY,
      to_ts: currentTime,
    }),
    [currentTime],
  );
  const financeSummaryAggregateQuery = useQuery({
    queryKey: ['datacenter', 'finance', 'summary-aggregate', financeAggregateQuery],
    refetchInterval: FINANCE_REFETCH_INTERVAL_MS,
    queryFn: async () => {
      const payload = await getFinanceSummaryViaContract(financeAggregateQuery);
      return payload.data;
    },
  });
  const financeProjectPerformanceAggregateQuery = useQuery({
    queryKey: ['datacenter', 'finance', 'project-performance-aggregate', financeAggregateQuery],
    refetchInterval: FINANCE_REFETCH_INTERVAL_MS,
    queryFn: async () => {
      const payload = await getFinanceProjectPerformanceViaContract(financeAggregateQuery);
      return payload.data;
    },
  });
  const financeLoading =
    financeSummaryAggregateQuery.isLoading ||
    financeSummaryAggregateQuery.isFetching ||
    financeProjectPerformanceAggregateQuery.isLoading ||
    financeProjectPerformanceAggregateQuery.isFetching;
  const bots = useMemo<Record<string, BotRecord>>(
    () => (botsMapQuery.data || {}) as Record<string, BotRecord>,
    [botsMapQuery.data],
  );
  const botsLoading = botsMapQuery.isLoading;
  const licenses = useMemo<BotLicense[]>(
    () => licensesList.result.data || [],
    [licensesList.result.data],
  );
  const licensesLoading = licensesList.query.isLoading;
  const proxies = useMemo<ProxyResource[]>(
    () => proxiesList.result.data || [],
    [proxiesList.result.data],
  );
  const proxiesLoading = proxiesList.query.isLoading;
  const subscriptions = useMemo<Subscription[]>(
    () => subscriptionsList.result.data || [],
    [subscriptionsList.result.data],
  );
  const subscriptionsLoading = subscriptionsList.query.isLoading;
  const notesIndex = useMemo<NoteIndex[]>(() => notesIndexQuery.data || [], [notesIndexQuery.data]);
  const notesLoading = notesIndexQuery.isLoading;
  const warningDays = subscriptionSettingsQuery.data?.warning_days || 7;

  useEffect(() => {
    if (!financeSummaryAggregateQuery.error) {
      return;
    }
    uiLogger.error(
      'Error loading datacenter finance summary aggregates:',
      financeSummaryAggregateQuery.error,
    );
  }, [financeSummaryAggregateQuery.error]);
  useEffect(() => {
    if (!financeProjectPerformanceAggregateQuery.error) {
      return;
    }
    uiLogger.error(
      'Error loading datacenter finance project-performance aggregates:',
      financeProjectPerformanceAggregateQuery.error,
    );
  }, [financeProjectPerformanceAggregateQuery.error]);
  useEffect(() => {
    if (!botsMapQuery.error) {
      return;
    }
    uiLogger.error('Error loading bots:', botsMapQuery.error);
  }, [botsMapQuery.error]);
  useEffect(() => {
    if (!licensesList.query.error) return;
    uiLogger.error('Error loading licenses:', licensesList.query.error);
  }, [licensesList.query.error]);
  useEffect(() => {
    if (!proxiesList.query.error) return;
    uiLogger.error('Error loading proxies:', proxiesList.query.error);
  }, [proxiesList.query.error]);
  useEffect(() => {
    if (!subscriptionsList.query.error) return;
    uiLogger.error('Error loading subscriptions:', subscriptionsList.query.error);
  }, [subscriptionsList.query.error]);
  useEffect(() => {
    if (!notesIndexQuery.error) return;
    uiLogger.error('Error loading notes index:', notesIndexQuery.error);
  }, [notesIndexQuery.error]);
  useEffect(() => {
    if (!subscriptionSettingsQuery.error) return;
    uiLogger.error('Error loading subscription settings:', subscriptionSettingsQuery.error);
  }, [subscriptionSettingsQuery.error]);

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
    const summary = financeSummaryAggregateQuery.data;
    return {
      totalIncome: Number(summary?.income_total || 0),
      totalExpenses: Number(summary?.expense_total || 0),
      netProfit: Number(summary?.net_total || 0),
    };
  }, [financeSummaryAggregateQuery.data]);

  const financeGoldByProject = useMemo(() => {
    const seed = {
      wow_tbc: { totalGold: 0, priceSum: 0, priceCount: 0, avgPrice: 0 },
      wow_midnight: { totalGold: 0, priceSum: 0, priceCount: 0, avgPrice: 0 },
    };

    (financeProjectPerformanceAggregateQuery.data?.items || []).forEach(
      (item: Record<string, unknown>) => {
        const projectId = String(item.project_id || '');
        if (!(projectId in seed)) {
          return;
        }

        const projectKey = projectId as 'wow_tbc' | 'wow_midnight';
        const totalGold = Number(item.gold_volume || 0);
        const incomeTotal = Number(item.income_total || 0);

        seed[projectKey].totalGold = totalGold;
        if (totalGold > 0) {
          seed[projectKey].priceSum = (incomeTotal * 1000) / totalGold;
          seed[projectKey].priceCount = 1;
        }
      },
    );

    (Object.keys(seed) as Array<'wow_tbc' | 'wow_midnight'>).forEach((key) => {
      const entry = seed[key];
      entry.avgPrice = entry.priceCount > 0 ? entry.priceSum / entry.priceCount : 0;
    });

    return seed;
  }, [financeProjectPerformanceAggregateQuery.data?.items]);

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
