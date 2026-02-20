import {
  DownOutlined,
  GlobalOutlined,
  PlusOutlined,
  ReloadOutlined,
  RightOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { Button, Card, Input, Modal, message, Select, Table, Typography } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useBotsMapQuery } from '../../entities/bot/api/useBotQueries';
import {
  checkIPQuality,
  isIPQSCheckEnabled,
  isProxySuspicious,
  updateProxyWithIPQSData,
} from '../../entities/resources/api/ipqsFacade';
import {
  useDeleteProxyMutation,
  useUpdateProxyMutation,
} from '../../entities/resources/api/useProxyMutations';
import { useProxiesQuery } from '../../entities/resources/api/useResourcesQueries';
import type { Proxy as ProxyResource } from '../../types';
import styles from './ProxiesPage.module.css';
import { ProxiesStatsCards } from './ProxiesStatsCards';
import { ProxyCrudModal } from './ProxyCrudModal';
import {
  buildProxyStats,
  DEFAULT_PROVIDERS,
  extractCountries,
  filterProxies,
  mapProxiesWithBots,
  type ProxiesBotMap,
  STATS_COLLAPSED_KEY,
} from './proxiesPageModel';
import { buildProxyColumns, type ProxyWithBot } from './proxyColumns';

const { Title, Text } = Typography;
const { Option } = Select;
const { confirm } = Modal;

export const ProxiesPage: React.FC = () => {
  const botsMapQuery = useBotsMapQuery();
  const proxiesQuery = useProxiesQuery();
  const updateProxyMutation = useUpdateProxyMutation();
  const deleteProxyMutation = useDeleteProxyMutation();
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProxy, setEditingProxy] = useState<ProxyWithBot | null>(null);
  const [checkingProxyId, setCheckingProxyId] = useState<string | null>(null);
  const [providers, setProviders] = useState<string[]>(DEFAULT_PROVIDERS);
  const [statsCollapsed, setStatsCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem(STATS_COLLAPSED_KEY);
    return saved ? Boolean(JSON.parse(saved)) : false;
  });

  const bots = useMemo<ProxiesBotMap>(() => {
    const source = botsMapQuery.data || {};
    return source as unknown as ProxiesBotMap;
  }, [botsMapQuery.data]);

  const proxies = useMemo<ProxyWithBot[]>(
    () => mapProxiesWithBots(proxiesQuery.data || [], bots),
    [bots, proxiesQuery.data],
  );

  const loading = proxiesQuery.isLoading || botsMapQuery.isLoading;

  useEffect(() => {
    if (!proxiesQuery.error) {
      return;
    }
    message.error('Failed to load proxies');
  }, [proxiesQuery.error]);

  useEffect(() => {
    if (!botsMapQuery.error) {
      return;
    }
    message.error('Failed to load bots');
  }, [botsMapQuery.error]);

  useEffect(() => {
    const existingProviders = [...new Set(proxies.map((proxy) => proxy.provider).filter(Boolean))];
    if (existingProviders.length > 0) {
      setProviders(existingProviders);
      return;
    }

    setProviders(DEFAULT_PROVIDERS);
  }, [proxies]);

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
            await deleteProxyMutation.mutateAsync(proxy.id);
            message.success('');
          } catch {
            message.error('Failed to delete proxy');
          }
        },
      });
    },
    [deleteProxyMutation],
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
        const updates = updateProxyWithIPQSData(proxy, data);
        if (suspicious) {
          updates.status = 'banned';
        }

        await updateProxyMutation.mutateAsync({ id: proxy.id, payload: updates });
        const statusMessage = suspicious ? '' : '';
        message.success(`Proxy checked! Fraud Score: ${data.fraud_score}${statusMessage}`);
      } catch {
        message.error('Failed to recheck proxy');
      } finally {
        setCheckingProxyId(null);
      }
    },
    [updateProxyMutation],
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

  const filteredProxies = useMemo(
    () =>
      filterProxies(proxies, {
        searchText,
        statusFilter,
        typeFilter,
        countryFilter,
      }),
    [countryFilter, proxies, searchText, statusFilter, typeFilter],
  );

  const stats = useMemo(
    () => buildProxyStats(proxies, { isExpired, isExpiringSoon }),
    [isExpired, isExpiringSoon, proxies],
  );

  const countries = useMemo(() => extractCountries(proxies), [proxies]);

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
            onChange={(event) => setSearchText(event.target.value)}
            className={styles.filterSearch}
          />
          <Select
            placeholder="Status"
            value={statusFilter}
            onChange={setStatusFilter}
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
            onChange={setTypeFilter}
            className={styles.filterSelectSm}
          >
            <Option value="all">All Types</Option>
            <Option value="http">HTTP</Option>
            <Option value="socks5">SOCKS5</Option>
          </Select>
          <Select
            placeholder="Country"
            value={countryFilter}
            onChange={setCountryFilter}
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
            onClick={() => {
              setSearchText('');
              setStatusFilter('all');
              setTypeFilter('all');
              setCountryFilter('all');
            }}
          >
            Reset
          </Button>
        </div>
      </Card>

      <Card className={styles.tableCard}>
        <Table
          dataSource={filteredProxies}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} proxies`,
          }}
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
