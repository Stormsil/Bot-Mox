import { useModalForm, useTable } from '@refinedev/antd';
import { type HttpError, useList, useUpdate } from '@refinedev/core';
import { Card, message, Table } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BotRecord } from '../../entities/bot/model/types';
import {
  checkIPQuality,
  isIPQSCheckEnabled,
  isProxySuspicious,
  updateProxyWithIPQSData,
} from '../../entities/resources/api/ipqsFacade';
import type { Proxy as ProxyResource } from '../../entities/resources/model/types';
import { ProxiesFiltersCard } from './ProxiesFiltersCard';
import styles from './ProxiesPage.module.css';
import { ProxiesPageHeader } from './ProxiesPageHeader';
import { ProxiesStatsCards } from './ProxiesStatsCards';
import { ProxyCrudModal } from './ProxyCrudModal';
import {
  buildProxyStats,
  DEFAULT_PROVIDERS,
  extractCountries,
  mapProxiesWithBots,
  type ProxiesBotMap,
  STATS_COLLAPSED_KEY,
} from './proxiesPageModel';
import {
  buildProxiesTableFilters,
  DEFAULT_PROXIES_TABLE_FILTERS,
  type ProxiesTableFilterValues,
  readProxiesTableFilterValues,
} from './proxiesTableFilters';
import { buildProxyColumns, type ProxyWithBot } from './proxyColumns';

const BOT_POLL_MS = 5_000;
const LARGE_PAGE_SIZE = 5_000;

export const ProxiesPage: React.FC = () => {
  const syncWithLocationEnabled = !(typeof navigator !== 'undefined' && navigator.webdriver);

  const proxiesTable = useTable<ProxyResource>({
    resource: 'proxies',
    syncWithLocation: syncWithLocationEnabled,
    pagination: {
      mode: 'server',
      pageSize: 10,
    },
    queryOptions: syncWithLocationEnabled
      ? undefined
      : {
          refetchOnMount: false,
          refetchOnWindowFocus: false,
          refetchOnReconnect: false,
          staleTime: 60_000,
        },
  });
  const botsList = useList<BotRecord>({
    resource: 'bots',
    pagination: {
      mode: 'server',
      currentPage: 1,
      pageSize: LARGE_PAGE_SIZE,
    },
    queryOptions: {
      refetchInterval: BOT_POLL_MS,
    },
  });
  const updateProxy = useUpdate<ProxyResource, HttpError, Partial<ProxyResource>>();
  const createProxyModal = useModalForm<ProxyResource, HttpError, Omit<ProxyResource, 'id'>>({
    resource: 'proxies',
    action: 'create',
    autoSubmitClose: false,
    syncWithLocation: false,
  });
  const editProxyModal = useModalForm<ProxyResource, HttpError, Partial<ProxyResource>>({
    resource: 'proxies',
    action: 'edit',
    autoSubmitClose: false,
    syncWithLocation: false,
  });

  const [checkingProxyId, setCheckingProxyId] = useState<string | null>(null);
  const [providers, setProviders] = useState<string[]>(DEFAULT_PROVIDERS);
  const [statsCollapsed, setStatsCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem(STATS_COLLAPSED_KEY);
    return saved ? Boolean(JSON.parse(saved)) : false;
  });

  const bots = useMemo<ProxiesBotMap>(() => {
    const list = botsList.result.data || [];
    return list.reduce<ProxiesBotMap>((acc, bot) => {
      acc[bot.id] = bot;
      return acc;
    }, {});
  }, [botsList.result.data]);

  const tableProxies = useMemo<ProxyWithBot[]>(
    () =>
      mapProxiesWithBots(
        (proxiesTable.tableProps.dataSource as ProxyResource[] | undefined) ?? [],
        bots,
      ),
    [bots, proxiesTable.tableProps.dataSource],
  );

  const tableFilters = useMemo(
    () => readProxiesTableFilterValues(proxiesTable.filters),
    [proxiesTable.filters],
  );

  const setMergedFilters = useCallback(
    (nextPartial: Partial<ProxiesTableFilterValues>) => {
      proxiesTable.setFilters(
        buildProxiesTableFilters({
          q: nextPartial.q ?? tableFilters.q,
          status: nextPartial.status ?? tableFilters.status,
          type: nextPartial.type ?? tableFilters.type,
          country: nextPartial.country ?? tableFilters.country,
        }),
        'replace',
      );
    },
    [proxiesTable, tableFilters],
  );

  const resetFilters = useCallback(() => {
    proxiesTable.setFilters(buildProxiesTableFilters(DEFAULT_PROXIES_TABLE_FILTERS), 'replace');
  }, [proxiesTable]);

  const loading = Boolean(proxiesTable.tableProps.loading) || botsList.query.isLoading;

  useEffect(() => {
    if (!proxiesTable.tableQuery.error) {
      return;
    }
    message.error('Failed to load proxies');
  }, [proxiesTable.tableQuery.error]);

  useEffect(() => {
    if (!botsList.query.error) {
      return;
    }
    message.error('Failed to load bots');
  }, [botsList.query.error]);

  useEffect(() => {
    const existingProviders = [
      ...new Set(tableProxies.map((proxy) => proxy.provider).filter(Boolean)),
    ];
    if (existingProviders.length > 0) {
      setProviders(existingProviders);
      return;
    }

    setProviders(DEFAULT_PROVIDERS);
  }, [tableProxies]);

  useEffect(() => {
    localStorage.setItem(STATS_COLLAPSED_KEY, JSON.stringify(statsCollapsed));
  }, [statsCollapsed]);

  const isExpired = useCallback((expiresAt: number) => Date.now() > expiresAt, []);

  const isExpiringSoon = useCallback((expiresAt: number) => {
    const daysUntilExpiry = Math.ceil((expiresAt - Date.now()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
  }, []);

  const handleProviderCreated = useCallback((providerName: string) => {
    if (!providerName) {
      return;
    }

    setProviders((prev) => (prev.includes(providerName) ? prev : [...prev, providerName]));
  }, []);

  const copyProxyString = useCallback((proxy: ProxyResource, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation();
    }

    const proxyString = `${proxy.ip}:${proxy.port}:${proxy.login}:${proxy.password}`;
    navigator.clipboard.writeText(proxyString);
    message.success('');
  }, []);

  const handleRecheckIPQS = useCallback(
    async (proxy: ProxyWithBot) => {
      setCheckingProxyId(proxy.id);

      try {
        const isEnabled = await isIPQSCheckEnabled();
        if (!isEnabled) {
          message.warning(
            'IPQS check is disabled or API key not configured. Please check settings.',
          );
          return;
        }

        const data = await checkIPQuality(proxy.ip);
        if (!data) {
          message.error('Failed to check proxy with IPQS');
          return;
        }

        const suspicious = await isProxySuspicious(data.fraud_score);
        const updates = updateProxyWithIPQSData(proxy, data) as Partial<ProxyResource>;
        if (suspicious) {
          updates.status = 'banned';
        }

        await updateProxy.mutateAsync({
          resource: 'proxies',
          id: proxy.id,
          values: updates,
          invalidates: ['resourceAll'],
        });
        const statusMessage = suspicious ? '' : '';
        message.success(`Proxy checked! Fraud Score: ${data.fraud_score}${statusMessage}`);
      } catch {
        message.error('Failed to recheck proxy');
      } finally {
        setCheckingProxyId(null);
      }
    },
    [updateProxy],
  );

  const editingProxy = useMemo(() => {
    if (editProxyModal.id === undefined || editProxyModal.id === null) {
      return null;
    }

    const targetId = String(editProxyModal.id);
    return tableProxies.find((proxy) => String(proxy.id) === targetId) ?? null;
  }, [editProxyModal.id, tableProxies]);

  useEffect(() => {
    if (
      !editProxyModal.modalProps.open ||
      editProxyModal.id === undefined ||
      editProxyModal.id === null
    ) {
      return;
    }

    if (editingProxy) {
      return;
    }

    editProxyModal.close();
    message.warning('Proxy edit link is outdated. Opened list view instead.');
  }, [editProxyModal, editingProxy]);

  const columns = useMemo(
    () =>
      buildProxyColumns({
        checkingProxyId,
        isExpired,
        isExpiringSoon,
        copyProxyString,
        handleRecheckIPQS,
        onEdit: (proxyId) => editProxyModal.show(proxyId),
      }),
    [
      checkingProxyId,
      copyProxyString,
      handleRecheckIPQS,
      isExpired,
      isExpiringSoon,
      editProxyModal,
    ],
  );

  const stats = useMemo(
    () => buildProxyStats(tableProxies, { isExpired, isExpiringSoon }),
    [tableProxies, isExpired, isExpiringSoon],
  );

  const countries = useMemo(() => extractCountries(tableProxies), [tableProxies]);

  return (
    <div className={styles.root}>
      <ProxiesPageHeader
        statsCollapsed={statsCollapsed}
        onToggleStats={() => setStatsCollapsed((prev) => !prev)}
        onOpenCreate={() => createProxyModal.show()}
      />

      {!statsCollapsed && <ProxiesStatsCards stats={stats} />}

      <ProxiesFiltersCard
        filters={tableFilters}
        countries={countries}
        onChange={setMergedFilters}
        onReset={resetFilters}
      />

      <Card className={styles.tableCard}>
        <Table
          {...proxiesTable.tableProps}
          dataSource={tableProxies}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={
            proxiesTable.tableProps.pagination &&
            typeof proxiesTable.tableProps.pagination === 'object'
              ? {
                  ...proxiesTable.tableProps.pagination,
                  current: Math.max(1, Number(proxiesTable.tableProps.pagination.current) || 1),
                  pageSize: Math.max(1, Number(proxiesTable.tableProps.pagination.pageSize) || 10),
                  showSizeChanger: true,
                  showTotal: (total) => `Total ${total} proxies`,
                }
              : {
                  pageSize: 10,
                  showSizeChanger: true,
                  showTotal: (total) => `Total ${total} proxies`,
                }
          }
          size="small"
          tableLayout="fixed"
          scroll={{ x: 1170 }}
        />
      </Card>

      <ProxyCrudModal
        createModalProps={createProxyModal.modalProps}
        createFormProps={createProxyModal.formProps}
        editModalProps={editProxyModal.modalProps}
        editFormProps={editProxyModal.formProps}
        editingProxy={editingProxy}
        bots={bots}
        providers={providers}
        onProviderCreated={handleProviderCreated}
        onCreateFinish={createProxyModal.onFinish}
        onEditFinish={editProxyModal.onFinish}
        onCloseCreate={createProxyModal.close}
        onCloseEdit={editProxyModal.close}
        createSubmitting={createProxyModal.formLoading}
        editSubmitting={editProxyModal.formLoading}
      />
    </div>
  );
};
