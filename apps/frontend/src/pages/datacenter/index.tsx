import { useList } from '@refinedev/core';
import { useQuery } from '@tanstack/react-query';

import type React from 'react';
import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBotsMapQuery } from '../../entities/bot/api/useBotQueries';
import type { BotRecord } from '../../entities/bot/model/types';
import {
  type FinanceAggregateQuery,
  getFinanceProjectPerformanceViaContract,
  getFinanceSummaryViaContract,
} from '../../entities/finance/api/financeContractFacade';
import { useNotesIndexQuery } from '../../entities/notes/api/useNotesIndexQuery';
import type { NoteIndex } from '../../entities/notes/model/types';
import { fetchResourcesStatusAggregateViaContract } from '../../entities/resources/api/resourceContractFacade';
import type {
  BotLicense,
  Proxy as ProxyResource,
  Subscription,
} from '../../entities/resources/model/types';
import { uiLogger } from '../../observability/uiLogger';
import { AppSpin as Spin } from '../../shared/ui';
import { ContentPanel } from '../../widgets/layout/ContentPanel';
import { DatacenterContentMap } from './content-map';
import { cx } from './datacenterUi';
import { buildProjectStats, FINANCE_WINDOW_DAYS, MS_PER_DAY } from './page-helpers';
import { useDatacenterCollapsedSections, useDatacenterCurrentTime } from './useDatacenterState';

const RESOURCE_LIST_PAGE_SIZE = 5_000;

export const DatacenterPage: React.FC = () => {
  const navigate = useNavigate();
  const currentTime = useDatacenterCurrentTime();
  const botsMapQuery = useBotsMapQuery();
  const licensesList = useList<BotLicense>({
    resource: 'licenses',
    pagination: { mode: 'server', currentPage: 1, pageSize: RESOURCE_LIST_PAGE_SIZE },
  });
  const proxiesList = useList<ProxyResource>({
    resource: 'proxies',
    pagination: { mode: 'server', currentPage: 1, pageSize: RESOURCE_LIST_PAGE_SIZE },
  });
  const subscriptionsList = useList<Subscription>({
    resource: 'subscriptions',
    pagination: { mode: 'server', currentPage: 1, pageSize: RESOURCE_LIST_PAGE_SIZE },
  });
  const notesIndexQuery = useNotesIndexQuery();

  const { collapsedSections, toggleSection } = useDatacenterCollapsedSections();

  const financeAggregateQuery = useMemo<FinanceAggregateQuery>(
    () => ({
      from_ts: currentTime - FINANCE_WINDOW_DAYS * MS_PER_DAY,
      to_ts: currentTime,
    }),
    [currentTime],
  );
  const financeSummaryAggregateQuery = useQuery({
    queryKey: ['datacenter', 'finance', 'summary-aggregate', financeAggregateQuery],
    queryFn: async () => {
      const payload = await getFinanceSummaryViaContract(financeAggregateQuery);
      return payload.data;
    },
  });
  const financeProjectPerformanceAggregateQuery = useQuery({
    queryKey: ['datacenter', 'finance', 'project-performance-aggregate', financeAggregateQuery],
    queryFn: async () => {
      const payload = await getFinanceProjectPerformanceViaContract(financeAggregateQuery);
      return payload.data;
    },
  });
  const resourcesStatusAggregateQuery = useQuery({
    queryKey: ['datacenter', 'resources', 'status-aggregate'],
    queryFn: fetchResourcesStatusAggregateViaContract,
  });
  const financeLoading =
    financeSummaryAggregateQuery.isLoading ||
    financeSummaryAggregateQuery.isFetching ||
    financeProjectPerformanceAggregateQuery.isLoading ||
    financeProjectPerformanceAggregateQuery.isFetching;
  const resourcesStatusLoading =
    resourcesStatusAggregateQuery.isLoading || resourcesStatusAggregateQuery.isFetching;
  const bots = useMemo<Record<string, BotRecord>>(
    () => (botsMapQuery.data || {}) as Record<string, BotRecord>,
    [botsMapQuery.data],
  );
  const botsLoading = botsMapQuery.isLoading;
  const licensesLoading = licensesList.query.isLoading;
  const proxiesLoading = proxiesList.query.isLoading;
  const subscriptionsLoading = subscriptionsList.query.isLoading;
  const notesIndex = useMemo<NoteIndex[]>(() => notesIndexQuery.data || [], [notesIndexQuery.data]);
  const notesLoading = notesIndexQuery.isLoading;

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
    if (!resourcesStatusAggregateQuery.error) {
      return;
    }
    uiLogger.error(
      'Error loading datacenter resources status aggregate:',
      resourcesStatusAggregateQuery.error,
    );
  }, [resourcesStatusAggregateQuery.error]);
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
    const tbcEntry = (financeProjectPerformanceAggregateQuery.data?.items || []).find(
      (item: Record<string, unknown>) => String(item.project_id || '') === 'wow_tbc',
    );
    const midnightEntry = (financeProjectPerformanceAggregateQuery.data?.items || []).find(
      (item: Record<string, unknown>) => String(item.project_id || '') === 'wow_midnight',
    );

    return {
      wow_tbc: {
        totalGold: Number(tbcEntry?.gold_volume || 0),
        priceSum: 0,
        priceCount: 0,
        avgPrice: Number(tbcEntry?.average_gold_price || 0),
      },
      wow_midnight: {
        totalGold: Number(midnightEntry?.gold_volume || 0),
        priceSum: 0,
        priceCount: 0,
        avgPrice: Number(midnightEntry?.average_gold_price || 0),
      },
    };
  }, [financeProjectPerformanceAggregateQuery.data?.items]);

  const licenseStats = useMemo(() => {
    const data = resourcesStatusAggregateQuery.data?.summary?.licenses;
    return {
      total: Number(data?.total || 0),
      active: Number(data?.active || 0),
      expiringSoon: Number(data?.expiring_soon || 0),
      expired: Number(data?.expired || 0),
      unassigned: Number(data?.unassigned || 0),
    };
  }, [resourcesStatusAggregateQuery.data?.summary?.licenses]);

  const proxyStats = useMemo(() => {
    const data = resourcesStatusAggregateQuery.data?.summary?.proxies;
    return {
      total: Number(data?.total || 0),
      active: Number(data?.active || 0),
      expiringSoon: Number(data?.expiring_soon || 0),
      expired: Number(data?.expired || 0),
      unassigned: Number(data?.unassigned || 0),
    };
  }, [resourcesStatusAggregateQuery.data?.summary?.proxies]);

  const subscriptionStats = useMemo(() => {
    const data = resourcesStatusAggregateQuery.data?.summary?.subscriptions;
    return {
      total: Number(data?.total || 0),
      active: Number(data?.active || 0),
      expired: Number(data?.expired || 0),
      expiringSoon: Number(data?.expiring_soon || 0),
    };
  }, [resourcesStatusAggregateQuery.data?.summary?.subscriptions]);

  const notesStats = useMemo(() => {
    const total = notesIndex.length;
    const pinned = notesIndex.filter((note) => note.is_pinned).length;
    return { total, pinned };
  }, [notesIndex]);

  const latestNotes = useMemo(() => notesIndex.slice(0, 5), [notesIndex]);

  const expiringItems = useMemo(() => {
    return (resourcesStatusAggregateQuery.data?.expiring_items || []).map((item) => ({
      id: String(item.id || ''),
      type: item.type,
      name: String(item.name || ''),
      botName: item.bot_id ? bots[item.bot_id]?.character?.name : undefined,
      daysRemaining: Number(item.days_remaining || 0),
      expiresAt: Number(item.expires_at || 0),
    }));
  }, [resourcesStatusAggregateQuery.data?.expiring_items, bots]);

  const initialLoading =
    botsLoading &&
    licensesLoading &&
    proxiesLoading &&
    subscriptionsLoading &&
    financeLoading &&
    resourcesStatusLoading &&
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
