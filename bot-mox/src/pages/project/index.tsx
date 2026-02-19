import { DesktopOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Input, message, Select, Space, Table, Typography } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ContentPanel } from '../../components/layout/ContentPanel';
import { useDeleteBotMutation } from '../../entities/bot/api/useBotMutations';
import { useBotsMapQuery } from '../../entities/bot/api/useBotQueries';
import {
  useLicensesQuery,
  useProxiesQuery,
  useSubscriptionsQuery,
} from '../../entities/resources/api/useResourcesQueries';
import { getDefaultSettings } from '../../entities/settings/api/settingsFacade';
import { useProjectSettingsQuery } from '../../entities/settings/api/useProjectSettingsQuery';
import { useSubscriptionSettingsQuery } from '../../entities/settings/api/useSubscriptionSettingsQuery';
import { uiLogger } from '../../observability/uiLogger';
import type {
  BotLicense,
  Proxy as ProxyResource,
  Subscription,
  SubscriptionSettings,
} from '../../types';
import { createProjectColumns } from './columns';
import styles from './ProjectPage.module.css';
import {
  buildBotRows,
  buildProjectStats,
  buildResourcesByBotMaps,
  filterBotRows,
} from './selectors';
import type { BotRecord, StatusFilter } from './types';
import { formatProjectTitle, parseStatusFilterFromParams } from './utils';

const { Title, Text } = Typography;
const { Option } = Select;

export const ProjectPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const projectId = (id || '').trim();
  const botsMapQuery = useBotsMapQuery();
  const proxiesQuery = useProxiesQuery();
  const subscriptionsQuery = useSubscriptionsQuery();
  const licensesQuery = useLicensesQuery();
  const deleteBotMutation = useDeleteBotMutation();
  const subscriptionSettingsQuery = useSubscriptionSettingsQuery();
  const projectSettingsQuery = useProjectSettingsQuery();

  const bots = useMemo(
    () => (botsMapQuery.data || {}) as Record<string, BotRecord>,
    [botsMapQuery.data],
  );
  const projectsMeta = useMemo<Record<string, { name: string }>>(
    () =>
      Object.fromEntries(
        Object.entries(projectSettingsQuery.data || {}).map(([projectKey, project]) => [
          projectKey,
          { name: project.name || projectKey },
        ]),
      ),
    [projectSettingsQuery.data],
  );
  const proxies = useMemo<ProxyResource[]>(() => proxiesQuery.data || [], [proxiesQuery.data]);
  const subscriptions = useMemo<Subscription[]>(
    () => subscriptionsQuery.data || [],
    [subscriptionsQuery.data],
  );
  const licenses = useMemo<BotLicense[]>(() => licensesQuery.data || [], [licensesQuery.data]);
  const settings = useMemo<SubscriptionSettings>(
    () => subscriptionSettingsQuery.data || getDefaultSettings(),
    [subscriptionSettingsQuery.data],
  );

  const loadingBots = botsMapQuery.isLoading;
  const loadingProxies = proxiesQuery.isLoading;
  const loadingSubscriptions = subscriptionsQuery.isLoading;
  const loadingLicenses = licensesQuery.isLoading;
  const loadingSettings = subscriptionSettingsQuery.isLoading;

  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() =>
    parseStatusFilterFromParams(searchParams),
  );
  const [deletingBotIds, setDeletingBotIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const next = parseStatusFilterFromParams(searchParams);
    setStatusFilter((prev) => (prev === next ? prev : next));
  }, [searchParams]);

  const updateStatusFilter = useCallback(
    (next: StatusFilter) => {
      setStatusFilter(next);
      const params = new URLSearchParams(searchParams);
      if (next === 'all') {
        params.delete('status');
      } else {
        params.set('status', next);
      }
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  useEffect(() => {
    if (botsMapQuery.error) {
      uiLogger.error('Error loading bots:', botsMapQuery.error);
    }
  }, [botsMapQuery.error]);
  useEffect(() => {
    if (proxiesQuery.error) {
      uiLogger.error('Error loading proxies:', proxiesQuery.error);
    }
  }, [proxiesQuery.error]);
  useEffect(() => {
    if (subscriptionsQuery.error) {
      uiLogger.error('Error loading subscriptions:', subscriptionsQuery.error);
    }
  }, [subscriptionsQuery.error]);
  useEffect(() => {
    if (licensesQuery.error) {
      uiLogger.error('Error loading licenses:', licensesQuery.error);
    }
  }, [licensesQuery.error]);

  useEffect(() => {
    if (!projectSettingsQuery.error) {
      return;
    }
    uiLogger.error('Error loading project settings:', projectSettingsQuery.error);
  }, [projectSettingsQuery.error]);
  useEffect(() => {
    if (!subscriptionSettingsQuery.error) {
      return;
    }
    uiLogger.error('Error loading subscription settings:', subscriptionSettingsQuery.error);
  }, [subscriptionSettingsQuery.error]);

  const resourcesByBot = useMemo(
    () => buildResourcesByBotMaps({ proxies, subscriptions, licenses }),
    [licenses, proxies, subscriptions],
  );

  const rows = useMemo(
    () =>
      buildBotRows({
        bots,
        projectId,
        warningDays: settings.warning_days,
        resourcesByBot,
      }),
    [bots, projectId, resourcesByBot, settings.warning_days],
  );

  const filteredRows = useMemo(
    () => filterBotRows(rows, searchText, statusFilter),
    [rows, searchText, statusFilter],
  );

  const stats = useMemo(() => buildProjectStats(rows), [rows]);

  const goToBot = useCallback(
    (botId: string, tab?: string) => {
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
    },
    [navigate],
  );

  const handleDeleteAccount = useCallback(
    async (botId: string) => {
      if (!botId || deletingBotIds[botId]) return;

      setDeletingBotIds((prev) => ({ ...prev, [botId]: true }));
      try {
        await deleteBotMutation.mutateAsync(botId);
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
    },
    [deleteBotMutation, deletingBotIds],
  );

  const columns = useMemo(
    () =>
      createProjectColumns({
        goToBot,
        deletingBotIds,
        onDeleteAccount: handleDeleteAccount,
      }),
    [deletingBotIds, goToBot, handleDeleteAccount],
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
              <Text type="secondary" className={styles.headerSubtitle}>
                Accounts summary table
              </Text>
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
          <Space wrap className={styles.filtersRow}>
            <Input
              placeholder="Search by ID, character, email, server..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              className={styles.searchInput}
            />
            <Select
              placeholder="Bot Status"
              value={statusFilter}
              onChange={(value) => updateStatusFilter(value as StatusFilter)}
              className={styles.statusSelect}
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
              className={styles.resetButton}
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
            className={styles.table}
            rowClassName={() => styles.tableRow}
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
