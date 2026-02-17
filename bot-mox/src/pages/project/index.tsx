import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Alert, Button, Card, Input, Select, Space, Table, Typography, message } from 'antd';
import { DesktopOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { ContentPanel } from '../../components/layout/ContentPanel';
import type { BotLicense, Proxy, Subscription, SubscriptionSettings } from '../../types';
import { deleteBot, subscribeBotsMap } from '../../services/botsApiService';
import { getDefaultSettings, getSubscriptionSettings } from '../../services/settingsService';
import { subscribeResources } from '../../services/resourcesApiService';
import { subscribeToProjectSettings } from '../../services/projectSettingsService';
import { createProjectColumns } from './columns';
import { buildBotRows, buildProjectStats, buildResourcesByBotMaps, filterBotRows } from './selectors';
import type { BotRecord, StatusFilter } from './types';
import { formatProjectTitle, parseStatusFilterFromParams } from './utils';
import styles from './ProjectPage.module.css';

const { Title, Text } = Typography;
const { Option } = Select;

export const ProjectPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const projectId = (id || '').trim();

  const [bots, setBots] = useState<Record<string, BotRecord>>({});
  const [projectsMeta, setProjectsMeta] = useState<Record<string, { name: string }>>({});
  const [proxies, setProxies] = useState<Proxy[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [licenses, setLicenses] = useState<BotLicense[]>([]);
  const [settings, setSettings] = useState<SubscriptionSettings>(getDefaultSettings());

  const [loadingBots, setLoadingBots] = useState(true);
  const [loadingProxies, setLoadingProxies] = useState(true);
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(true);
  const [loadingLicenses, setLoadingLicenses] = useState(true);
  const [loadingSettings, setLoadingSettings] = useState(true);

  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() =>
    parseStatusFilterFromParams(searchParams)
  );
  const [deletingBotIds, setDeletingBotIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const next = parseStatusFilterFromParams(searchParams);
    setStatusFilter((prev) => (prev === next ? prev : next));
  }, [searchParams]);

  const updateStatusFilter = useCallback((next: StatusFilter) => {
    setStatusFilter(next);
    const params = new URLSearchParams(searchParams);
    if (next === 'all') {
      params.delete('status');
    } else {
      params.set('status', next);
    }
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const unsubscribeBots = subscribeBotsMap(
      (data) => {
        setBots((data || {}) as Record<string, BotRecord>);
        setLoadingBots(false);
      },
      () => setLoadingBots(false),
      { intervalMs: 5000 }
    );

    const unsubscribeProxies = subscribeResources<Proxy>(
      'proxies',
      (list) => {
        setProxies(list || []);
        setLoadingProxies(false);
      },
      () => setLoadingProxies(false),
      { intervalMs: 7000 }
    );

    const unsubscribeSubscriptions = subscribeResources<Subscription>(
      'subscriptions',
      (list) => {
        setSubscriptions(list || []);
        setLoadingSubscriptions(false);
      },
      () => setLoadingSubscriptions(false),
      { intervalMs: 7000 }
    );

    const unsubscribeLicenses = subscribeResources<BotLicense>(
      'licenses',
      (list) => {
        setLicenses(list || []);
        setLoadingLicenses(false);
      },
      () => setLoadingLicenses(false),
      { intervalMs: 7000 }
    );

    return () => {
      unsubscribeBots();
      unsubscribeProxies();
      unsubscribeSubscriptions();
      unsubscribeLicenses();
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    setLoadingSettings(true);
    getSubscriptionSettings()
      .then((nextSettings) => {
        if (mounted) {
          setSettings(nextSettings);
        }
      })
      .finally(() => {
        if (mounted) {
          setLoadingSettings(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToProjectSettings(
      (projects) => {
        const mapped = Object.fromEntries(
          Object.entries(projects).map(([projectKey, project]) => [
            projectKey,
            { name: project.name || projectKey },
          ])
        );
        setProjectsMeta(mapped);
      },
      (error) => {
        console.error('Error loading project settings:', error);
      }
    );

    return unsubscribe;
  }, []);

  const resourcesByBot = useMemo(
    () => buildResourcesByBotMaps({ proxies, subscriptions, licenses }),
    [licenses, proxies, subscriptions]
  );

  const rows = useMemo(
    () =>
      buildBotRows({
        bots,
        projectId,
        warningDays: settings.warning_days,
        resourcesByBot,
      }),
    [bots, projectId, resourcesByBot, settings.warning_days]
  );

  const filteredRows = useMemo(
    () => filterBotRows(rows, searchText, statusFilter),
    [rows, searchText, statusFilter]
  );

  const stats = useMemo(() => buildProjectStats(rows), [rows]);

  const goToBot = useCallback((botId: string, tab?: string) => {
    if (!tab) {
      navigate(`/bot/${botId}`);
      return;
    }

    if (['schedule', 'account', 'character', 'person'].includes(tab)) {
      navigate(`/bot/${botId}?tab=configure&subtab=${tab}`);
      return;
    }

    if (['license', 'proxy', 'subscription'].includes(tab)) {
      navigate(`/bot/${botId}?tab=resources&subtab=${tab}`);
      return;
    }

    if (tab === 'lifeStages') {
      navigate(`/bot/${botId}?tab=monitoring`);
      return;
    }

    navigate(`/bot/${botId}?tab=${tab}`);
  }, [navigate]);

  const handleDeleteAccount = useCallback(async (botId: string) => {
    if (!botId || deletingBotIds[botId]) return;

    setDeletingBotIds((prev) => ({ ...prev, [botId]: true }));
    try {
      await deleteBot(botId);
      message.success(`Account ${botId.slice(0, 8)} deleted`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      message.error(`Failed to delete account: ${errorMessage}`);
    } finally {
      setDeletingBotIds((prev) => {
        const next = { ...prev };
        delete next[botId];
        return next;
      });
    }
  }, [deletingBotIds]);

  const columns = useMemo(
    () =>
      createProjectColumns({
        goToBot,
        deletingBotIds,
        onDeleteAccount: handleDeleteAccount,
      }),
    [deletingBotIds, goToBot, handleDeleteAccount]
  );

  if (!projectId) {
    return (
      <div className={styles.root}>
        <ContentPanel type="project" hideTabs>
          <Alert
            message="Project not found"
            description={`Project "${id}" does not exist.`}
            type="error"
            showIcon
          />
        </ContentPanel>
      </div>
    );
  }

  const loading =
    loadingBots || loadingProxies || loadingSubscriptions || loadingLicenses || loadingSettings;

  const projectTitle = projectsMeta[projectId]?.name || formatProjectTitle(projectId);

  return (
    <div className={styles.root}>
      <ContentPanel type="project" hideTabs>
        <Card className={styles.header}>
          <div className={styles.headerContent}>
            <div className={styles.headerTitle}>
              <Title level={4} className={styles.headerHeading}>
                <DesktopOutlined /> {projectTitle}
              </Title>
              <Text type="secondary" className={styles.headerSubtitle}>Accounts summary table</Text>
            </div>
          </div>
        </Card>

        <div className={styles.stats}>
          <Card className={styles.statCard}>
            <div className={styles.statValue}>{stats.total}</div>
            <div className={styles.statLabel}>Total</div>
          </Card>
          <Card className={`${styles.statCard} ${styles.statCardActive}`}>
            <div className={styles.statValue}>{stats.active}</div>
            <div className={styles.statLabel}>Active</div>
          </Card>
          <Card className={`${styles.statCard} ${styles.statCardPrepare}`}>
            <div className={styles.statValue}>{stats.prepare}</div>
            <div className={styles.statLabel}>Prepare</div>
          </Card>
          <Card className={`${styles.statCard} ${styles.statCardWarning}`}>
            <div className={styles.statValue}>{stats.offline}</div>
            <div className={styles.statLabel}>Offline</div>
          </Card>
          <Card className={`${styles.statCard} ${styles.statCardBanned}`}>
            <div className={styles.statValue}>{stats.banned}</div>
            <div className={styles.statLabel}>Banned</div>
          </Card>
        </div>

        <Card className={styles.filters}>
          <Space wrap>
            <Input
              placeholder="Search by ID, character, email, server..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              style={{ width: 320 }}
            />
            <Select
              placeholder="Bot Status"
              value={statusFilter}
              onChange={(value) => updateStatusFilter(value as StatusFilter)}
              style={{ width: 160 }}
            >
              <Option value="all">All Statuses</Option>
              <Option value="offline">Offline</Option>
              <Option value="prepare">Prepare</Option>
              <Option value="leveling">Leveling</Option>
              <Option value="profession">Profession</Option>
              <Option value="farming">Farming</Option>
              <Option value="banned">Banned</Option>
            </Select>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                setSearchText('');
                updateStatusFilter('all');
              }}
            >
              Reset
            </Button>
          </Space>
        </Card>

        <Card className={styles.tableCard}>
          <Table
            dataSource={filteredRows}
            columns={columns}
            rowKey="id"
            loading={loading}
            pagination={{
              pageSize: 15,
              showSizeChanger: true,
              showTotal: (total) => `Total ${total} accounts`,
            }}
            size="small"
          />
        </Card>
      </ContentPanel>
    </div>
  );
};
