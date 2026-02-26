import {
  DownOutlined,
  GlobalOutlined,
  PlusOutlined,
  ReloadOutlined,
  RightOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useTable } from '@refinedev/antd';
import { type CrudFilter, type HttpError, useDelete, useList, useUpdate } from '@refinedev/core';
import { Button, Card, Input, Modal, message, Select, Table, Typography } from 'antd';
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
import { buildProxyColumns, type ProxyWithBot } from './proxyColumns';

const { Title, Text } = Typography;
const { Option } = Select;
const { confirm } = Modal;

const RESOURCE_POLL_MS = 7_000;
const BOT_POLL_MS = 5_000;
const LARGE_PAGE_SIZE = 5_000;

function readFilterValue(filters: CrudFilter[], field: string, fallback: string): string {
  const match = filters.find(
    (item) => 'field' in item && String(item.field) === field && 'value' in item,
  );
  if (!match || !('value' in match)) {
    return fallback;
  }
  const value = match.value;
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  return String(value);
}

function buildTableFilters(values: {
  q: string;
  status: string;
  type: string;
  country: string;
}): CrudFilter[] {
  const next: CrudFilter[] = [];

  if (values.q.trim()) {
    next.push({ field: 'q', operator: 'eq', value: values.q.trim() });
  }
  if (values.status !== 'all') {
    next.push({ field: 'status', operator: 'eq', value: values.status });
  }
  if (values.type !== 'all') {
    next.push({ field: 'type', operator: 'eq', value: values.type });
  }
  if (values.country !== 'all') {
    next.push({ field: 'country', operator: 'eq', value: values.country });
  }

  return next;
}

export const ProxiesPage: React.FC = () => {
  const proxiesTable = useTable<ProxyResource>({
    resource: 'proxies',
    syncWithLocation: true,
    pagination: {
      mode: 'server',
      pageSize: 10,
    },
    queryOptions: {
      refetchInterval: RESOURCE_POLL_MS,
    },
  });
  const allProxiesList = useList<ProxyResource>({
    resource: 'proxies',
    pagination: {
      mode: 'server',
      currentPage: 1,
      pageSize: LARGE_PAGE_SIZE,
    },
    queryOptions: {
      refetchInterval: RESOURCE_POLL_MS,
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
  const deleteProxy = useDelete<ProxyResource>();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProxy, setEditingProxy] = useState<ProxyWithBot | null>(null);
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

  const allProxies = useMemo<ProxyWithBot[]>(
    () => mapProxiesWithBots(allProxiesList.result.data || [], bots),
    [allProxiesList.result.data, bots],
  );

  const searchText = readFilterValue(proxiesTable.filters, 'q', '');
  const statusFilter = readFilterValue(proxiesTable.filters, 'status', 'all');
  const typeFilter = readFilterValue(proxiesTable.filters, 'type', 'all');
  const countryFilter = readFilterValue(proxiesTable.filters, 'country', 'all');

  const setMergedFilters = useCallback(
    (nextPartial: Partial<{ q: string; status: string; type: string; country: string }>) => {
      proxiesTable.setFilters(
        buildTableFilters({
          q: nextPartial.q ?? searchText,
          status: nextPartial.status ?? statusFilter,
          type: nextPartial.type ?? typeFilter,
          country: nextPartial.country ?? countryFilter,
        }),
        'replace',
      );
    },
    [countryFilter, proxiesTable, searchText, statusFilter, typeFilter],
  );

  const loading =
    Boolean(proxiesTable.tableProps.loading) ||
    botsList.query.isLoading ||
    allProxiesList.query.isLoading;

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
    if (!allProxiesList.query.error) {
      return;
    }
    message.error('Failed to load proxy stats');
  }, [allProxiesList.query.error]);

  useEffect(() => {
    const existingProviders = [
      ...new Set(allProxies.map((proxy) => proxy.provider).filter(Boolean)),
    ];
    if (existingProviders.length > 0) {
      setProviders(existingProviders);
      return;
    }

    setProviders(DEFAULT_PROVIDERS);
  }, [allProxies]);

  useEffect(() => {
    localStorage.setItem(STATS_COLLAPSED_KEY, JSON.stringify(statsCollapsed));
  }, [statsCollapsed]);

  const isExpired = useCallback((expiresAt: number) => Date.now() > expiresAt, []);

  const isExpiringSoon = useCallback((expiresAt: number) => {
    const daysUntilExpiry = Math.ceil((expiresAt - Date.now()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
  }, []);

  const handleDelete = useCallback(
    (proxy: ProxyWithBot) => {
      confirm({
        title: '',
        content: `Are you sure you want to delete proxy ${proxy.ip}:${proxy.port}?`,
        okText: 'Delete',
        okType: 'danger',
        cancelText: 'Cancel',
        onOk: async () => {
          try {
            await deleteProxy.mutateAsync({
              resource: 'proxies',
              id: proxy.id,
              invalidates: ['resourceAll'],
            });
            message.success('');
          } catch {
            message.error('Failed to delete proxy');
          }
        },
      });
    },
    [deleteProxy],
  );

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

  const openEditModal = useCallback((proxy?: ProxyWithBot) => {
    setEditingProxy(proxy || null);
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingProxy(null);
  }, []);

  const columns = useMemo(
    () =>
      buildProxyColumns({
        checkingProxyId,
        isExpired,
        isExpiringSoon,
        copyProxyString,
        handleRecheckIPQS,
        openEditModal,
        handleDelete,
      }),
    [
      checkingProxyId,
      copyProxyString,
      handleDelete,
      handleRecheckIPQS,
      isExpired,
      isExpiringSoon,
      openEditModal,
    ],
  );

  const stats = useMemo(
    () => buildProxyStats(allProxies, { isExpired, isExpiringSoon }),
    [allProxies, isExpired, isExpiringSoon],
  );

  const countries = useMemo(() => extractCountries(allProxies), [allProxies]);

  return (
    <div className={styles.root}>
      <Card className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerTitle}>
            <Title level={4} className={styles.pageTitle}>
              <GlobalOutlined /> Proxies
            </Title>
            <Text type="secondary" className={styles.headerSubtitle}>
              Manage proxy servers for bots
            </Text>
          </div>
          <div className={styles.headerActions}>
            <Button
              type="text"
              icon={statsCollapsed ? <RightOutlined /> : <DownOutlined />}
              onClick={() => setStatsCollapsed((prev) => !prev)}
            >
              Stats
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditModal()}>
              Add Proxy
            </Button>
          </div>
        </div>
      </Card>

      {!statsCollapsed && <ProxiesStatsCards stats={stats} />}

      <Card className={styles.filters}>
        <div className={styles.filtersRow}>
          <Input
            placeholder="Search by IP, provider, country, ISP..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(event) => setMergedFilters({ q: event.target.value })}
            className={styles.filterSearch}
          />
          <Select
            placeholder="Status"
            value={statusFilter}
            onChange={(value) => setMergedFilters({ status: value })}
            className={styles.filterSelectMd}
          >
            <Option value="all">All Statuses</Option>
            <Option value="active">Active</Option>
            <Option value="expired">Expired</Option>
            <Option value="banned">Banned</Option>
          </Select>
          <Select
            placeholder="Type"
            value={typeFilter}
            onChange={(value) => setMergedFilters({ type: value })}
            className={styles.filterSelectSm}
          >
            <Option value="all">All Types</Option>
            <Option value="http">HTTP</Option>
            <Option value="socks5">SOCKS5</Option>
          </Select>
          <Select
            placeholder="Country"
            value={countryFilter}
            onChange={(value) => setMergedFilters({ country: value })}
            className={styles.filterSelectMd}
          >
            <Option value="all">All Countries</Option>
            {countries.map((country) => (
              <Option key={country} value={country}>
                {country}
              </Option>
            ))}
          </Select>
          <Button
            icon={<ReloadOutlined />}
            onClick={() =>
              proxiesTable.setFilters(
                buildTableFilters({ q: '', status: 'all', type: 'all', country: 'all' }),
                'replace',
              )
            }
          >
            Reset
          </Button>
        </div>
      </Card>

      <Card className={styles.tableCard}>
        <Table
          {...proxiesTable.tableProps}
          dataSource={tableProxies}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={
            proxiesTable.tableProps.pagination
              ? {
                  ...proxiesTable.tableProps.pagination,
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
        open={isModalOpen}
        editingProxy={editingProxy}
        bots={bots}
        providers={providers}
        onProviderCreated={handleProviderCreated}
        onClose={closeModal}
        onSaved={closeModal}
      />
    </div>
  );
};
