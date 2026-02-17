import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Input,
  Modal,
  Select,
  Table,
  Typography,
  message,
} from 'antd';
import {
  DownOutlined,
  GlobalOutlined,
  PlusOutlined,
  ReloadOutlined,
  RightOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import type { Proxy } from '../../types';
import {
  deleteProxyById,
  subscribeBots,
  subscribeProxies,
  updateProxyById,
  type ProxiesBotMap,
} from '../../services/proxyDataService';
import { buildProxyColumns, type ProxyWithBot } from './proxyColumns';
import {
  checkIPQuality,
  isIPQSCheckEnabled,
  isProxySuspicious,
  updateProxyWithIPQSData,
} from '../../services/ipqsService';
import { ProxyCrudModal } from './ProxyCrudModal';
import styles from './ProxiesPage.module.css';

const DEFAULT_PROVIDERS = ['IPRoyal', 'Smartproxy', 'Luminati', 'Oxylabs'];
const STATS_COLLAPSED_KEY = 'proxiesStatsCollapsed';

const { Title, Text } = Typography;
const { Option } = Select;
const { confirm } = Modal;

export const ProxiesPage: React.FC = () => {
  const [proxies, setProxies] = useState<ProxyWithBot[]>([]);
  const [bots, setBots] = useState<ProxiesBotMap>({});
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    const unsubscribeProxies = subscribeProxies(
      (proxiesList) => {
        setProxies(proxiesList as ProxyWithBot[]);
        setLoading(false);
      },
      () => {
        message.error('Failed to load proxies');
        setLoading(false);
      }
    );

    const unsubscribeBots = subscribeBots((data) => {
      setBots(data);
    });

    return () => {
      unsubscribeProxies();
      unsubscribeBots();
    };
  }, []);

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

  useEffect(() => {
    if (Object.keys(bots).length === 0 || proxies.length === 0) {
      return;
    }

    const needsUpdate = proxies.some((proxy) => {
      if (!proxy.bot_id) {
        return false;
      }

      const bot = bots[proxy.bot_id];
      const hasEnrichedData = Boolean(proxy.botCharacter || proxy.botVMName);
      const botHasData = Boolean(bot?.character?.name || bot?.vm?.name);
      return Boolean(bot && !hasEnrichedData && botHasData);
    });

    if (!needsUpdate) {
      return;
    }

    setProxies((prev) =>
      prev.map((proxy) => {
        if (proxy.bot_id && bots[proxy.bot_id]) {
          const bot = bots[proxy.bot_id];
          const characterName = bot.character?.name;
          const vmName = bot.vm?.name;
          return {
            ...proxy,
            botName: characterName,
            botCharacter: characterName,
            botVMName: vmName,
          };
        }

        return proxy;
      })
    );
  }, [bots, proxies]);

  const isExpired = useCallback((expiresAt: number) => Date.now() > expiresAt, []);

  const isExpiringSoon = useCallback((expiresAt: number) => {
    const daysUntilExpiry = Math.ceil((expiresAt - Date.now()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
  }, []);

  const handleDelete = useCallback((proxy: ProxyWithBot) => {
    confirm({
      title: 'Delete Proxy?',
      content: `Are you sure you want to delete proxy ${proxy.ip}:${proxy.port}?`,
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await deleteProxyById(proxy.id);
          message.success('Proxy deleted');
        } catch {
          message.error('Failed to delete proxy');
        }
      },
    });
  }, []);

  const handleProviderCreated = useCallback((providerName: string) => {
    if (!providerName) {
      return;
    }

    setProviders((prev) => (prev.includes(providerName) ? prev : [...prev, providerName]));
  }, []);

  const copyProxyString = useCallback((proxy: Proxy, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation();
    }

    const proxyString = `${proxy.ip}:${proxy.port}:${proxy.login}:${proxy.password}`;
    navigator.clipboard.writeText(proxyString);
    message.success('Proxy string copied to clipboard');
  }, []);

  const handleRecheckIPQS = useCallback(async (proxy: ProxyWithBot) => {
    setCheckingProxyId(proxy.id);

    try {
      const isEnabled = await isIPQSCheckEnabled();
      if (!isEnabled) {
        message.warning('IPQS check is disabled or API key not configured. Please check settings.');
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

      await updateProxyById(proxy.id, updates);
      const statusMessage = suspicious ? ' - WARNING: High fraud score! Proxy marked as banned.' : '';
      message.success(`Proxy checked! Fraud Score: ${data.fraud_score}${statusMessage}`);
    } catch {
      message.error('Failed to recheck proxy');
    } finally {
      setCheckingProxyId(null);
    }
  }, []);

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
    [checkingProxyId, copyProxyString, handleDelete, handleRecheckIPQS, isExpired, isExpiringSoon, openEditModal]
  );

  const filteredProxies = useMemo(
    () =>
      proxies.filter((proxy) => {
        const normalizedSearch = searchText.toLowerCase();
        const matchesSearch =
          proxy.ip.toLowerCase().includes(normalizedSearch)
          || proxy.provider.toLowerCase().includes(normalizedSearch)
          || (proxy.botName?.toLowerCase().includes(normalizedSearch) ?? false)
          || proxy.country.toLowerCase().includes(normalizedSearch)
          || (proxy.isp?.toLowerCase().includes(normalizedSearch) ?? false);

        const matchesStatus = statusFilter === 'all' || proxy.status === statusFilter;
        const matchesType = typeFilter === 'all' || proxy.type === typeFilter;
        const matchesCountry = countryFilter === 'all' || proxy.country === countryFilter;

        return matchesSearch && matchesStatus && matchesType && matchesCountry;
      }),
    [countryFilter, proxies, searchText, statusFilter, typeFilter]
  );

  const stats = useMemo(
    () => ({
      total: proxies.length,
      active: proxies.filter((proxy) => proxy.status === 'active' && !isExpired(proxy.expires_at)).length,
      expired: proxies.filter((proxy) => isExpired(proxy.expires_at)).length,
      expiringSoon: proxies.filter((proxy) => isExpiringSoon(proxy.expires_at)).length,
      unassigned: proxies.filter((proxy) => !proxy.bot_id).length,
    }),
    [isExpired, isExpiringSoon, proxies]
  );

  const countries = useMemo(
    () => [...new Set(proxies.map((proxy) => proxy.country).filter(Boolean))],
    [proxies]
  );

  return (
    <div className={styles.root}>
      <Card className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerTitle}>
            <Title level={4} className={styles.pageTitle}>
              <GlobalOutlined /> Proxies
            </Title>
            <Text type="secondary" className={styles.headerSubtitle}>Manage proxy servers for bots</Text>
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

      {!statsCollapsed && (
        <div className={styles.stats}>
          <Card className={styles.statCard}><div className={styles.statValue}>{stats.total}</div><div className={styles.statLabel}>Total</div></Card>
          <Card className={`${styles.statCard} ${styles.statCardActive}`}><div className={styles.statValue}>{stats.active}</div><div className={styles.statLabel}>Active</div></Card>
          <Card className={`${styles.statCard} ${styles.statCardWarning}`}><div className={styles.statValue}>{stats.expiringSoon}</div><div className={styles.statLabel}>Expiring Soon</div></Card>
          <Card className={`${styles.statCard} ${styles.statCardExpired}`}><div className={styles.statValue}>{stats.expired}</div><div className={styles.statLabel}>Expired</div></Card>
          <Card className={styles.statCard}><div className={styles.statValue}>{stats.unassigned}</div><div className={styles.statLabel}>Unassigned</div></Card>
        </div>
      )}

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
              <Option key={country} value={country}>{country}</Option>
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
