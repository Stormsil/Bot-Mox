import { DownOutlined, GlobalOutlined, PlusOutlined, RightOutlined } from '@ant-design/icons';
import { List, useModalForm, useTable } from '@refinedev/antd';
import { type HttpError, useList, useUpdate } from '@refinedev/core';
import { message } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BotRecord } from '../../entities/bot/model/types';
import {
  checkIPQuality,
  isIPQSCheckEnabled,
  isProxySuspicious,
  updateProxyWithIPQSData,
} from '../../entities/resources/api/ipqsFacade';
import type {
  ProxyMutationPatch,
  ProxyMutationPayload,
  Proxy as ProxyResource,
} from '../../entities/resources/model/types';
import {
  AppTable,
  AppButton as Button,
  AppCard as Card,
  AppFlex as Flex,
  AppSpace as Space,
  AppTypography as Typography,
} from '../../shared/ui';
import { ProxiesFiltersCard } from './ProxiesFiltersCard';
import styles from './ProxiesPage.module.css';
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
const { Title, Text } = Typography;

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
  const updateProxy = useUpdate<ProxyResource, HttpError, ProxyMutationPatch>();
  const createProxyModal = useModalForm<ProxyResource, HttpError, ProxyMutationPayload>({
    resource: 'proxies',
    action: 'create',
    autoSubmitClose: true,
    syncWithLocation: false,
  });
  const editProxyModal = useModalForm<ProxyResource, HttpError, ProxyMutationPatch>({
    resource: 'proxies',
    action: 'edit',
    autoSubmitClose: true,
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
        const updates = updateProxyWithIPQSData(proxy, data);
        if (suspicious) {
          updates.status = 'banned';
        }

        updateProxy.mutate(
          {
            resource: 'proxies',
            id: proxy.id,
            values: updates,
            invalidates: ['resourceAll'],
          },
          {
            onSettled: () => {
              setCheckingProxyId(null);
            },
          },
        );
      } catch {
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
        copyProxyString,
        handleRecheckIPQS,
        onEdit: (proxyId) => editProxyModal.show(proxyId),
      }),
    [checkingProxyId, copyProxyString, handleRecheckIPQS, editProxyModal],
  );

  const stats = useMemo(() => buildProxyStats(tableProxies), [tableProxies]);

  const countries = useMemo(() => extractCountries(tableProxies), [tableProxies]);

  return (
    <div className={styles.root}>
      <List
        wrapperProps={{ className: styles.header }}
        title={
          <Flex vertical className={styles.headerTitle}>
            <Title level={4}>
              <Space size={8}>
                <GlobalOutlined />
                <span>Proxies</span>
              </Space>
            </Title>
            <Text type="secondary" className={styles.headerSubtitle}>
              Manage proxy servers for bots
            </Text>
          </Flex>
        }
        headerButtons={({ defaultButtons }) => (
          <Space size={8}>
            <Button
              type="text"
              size="small"
              icon={statsCollapsed ? <RightOutlined /> : <DownOutlined />}
              onClick={() => setStatsCollapsed((prev) => !prev)}
            >
              Stats
            </Button>
            {defaultButtons}
            <Button
              type="primary"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => createProxyModal.show()}
            >
              Add Proxy
            </Button>
          </Space>
        )}
      >
        {!statsCollapsed && <ProxiesStatsCards stats={stats} />}

        <ProxiesFiltersCard
          filters={tableFilters}
          countries={countries}
          onChange={setMergedFilters}
          onReset={resetFilters}
        />

        <Card className={styles.tableCard}>
          <AppTable
            {...proxiesTable.tableProps}
            dataSource={tableProxies}
            columns={columns}
            rowKey="id"
            loading={loading}
            tableLayout="fixed"
            scroll={{ x: 1170 }}
          />
        </Card>
      </List>

      <ProxyCrudModal
        mode="create"
        modalProps={createProxyModal.modalProps}
        formProps={createProxyModal.formProps}
        bots={bots}
        providers={providers}
        onProviderCreated={handleProviderCreated}
      />
      <ProxyCrudModal
        mode="edit"
        modalProps={editProxyModal.modalProps}
        formProps={editProxyModal.formProps}
        editingProxy={editingProxy}
        bots={bots}
        providers={providers}
        onProviderCreated={handleProviderCreated}
      />
    </div>
  );
};
