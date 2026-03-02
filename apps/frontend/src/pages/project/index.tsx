import { DesktopOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { useDelete, useList } from '@refinedev/core';

import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useBotsMapQuery } from '../../entities/bot/api/useBotQueries';
import { getDefaultSettings } from '../../entities/settings/api/settingsFacade';
import { useProjectSettingsQuery } from '../../entities/settings/api/useProjectSettingsQuery';
import { useSubscriptionSettingsQuery } from '../../entities/settings/api/useSubscriptionSettingsQuery';
import { uiLogger } from '../../observability/uiLogger';
import type {
  BotLicense,
  Proxy as ProxyResource,
  Subscription,
  SubscriptionSettings,
} from '../../shared/types';
import {
  AppAlert as Alert,
  AppButton as Button,
  AppCard as Card,
  AppFlex as Flex,
  AppInput as Input,
  AppSelect as Select,
  AppSpace as Space,
  AppTable as Table,
  AppTypography as Typography,
} from '../../shared/ui';
import { ContentPanel } from '../../widgets/layout/ContentPanel';
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
const RESOURCE_REFETCH_INTERVAL_MS = 7_000;
const RESOURCE_LIST_PAGE_SIZE = 5_000;

export const ProjectPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const projectId = (id || '').trim();
  const botsMapQuery = useBotsMapQuery();
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
  const licensesList = useList<BotLicense>({
    resource: 'licenses',
    pagination: { mode: 'server', currentPage: 1, pageSize: RESOURCE_LIST_PAGE_SIZE },
    queryOptions: { refetchInterval: RESOURCE_REFETCH_INTERVAL_MS },
  });
  const deleteBotMutation = useDelete();
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
  const proxies = useMemo<ProxyResource[]>(
    () => proxiesList.result.data || [],
    [proxiesList.result.data],
  );
  const subscriptions = useMemo<Subscription[]>(
    () => subscriptionsList.result.data || [],
    [subscriptionsList.result.data],
  );
  const licenses = useMemo<BotLicense[]>(
    () => licensesList.result.data || [],
    [licensesList.result.data],
  );
  const settings = useMemo<SubscriptionSettings>(
    () => subscriptionSettingsQuery.data || getDefaultSettings(),
    [subscriptionSettingsQuery.data],
  );

  const loadingBots = botsMapQuery.isLoading;
  const loadingProxies = proxiesList.query.isLoading;
  const loadingSubscriptions = subscriptionsList.query.isLoading;
  const loadingLicenses = licensesList.query.isLoading;
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
    if (proxiesList.query.error) {
      uiLogger.error('Error loading proxies:', proxiesList.query.error);
    }
  }, [proxiesList.query.error]);
  useEffect(() => {
    if (subscriptionsList.query.error) {
      uiLogger.error('Error loading subscriptions:', subscriptionsList.query.error);
    }
  }, [subscriptionsList.query.error]);
  useEffect(() => {
    if (licensesList.query.error) {
      uiLogger.error('Error loading licenses:', licensesList.query.error);
    }
  }, [licensesList.query.error]);

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
    (botId: string) => {
      if (!botId || deletingBotIds[botId]) return;

      setDeletingBotIds((prev) => ({ ...prev, [botId]: true }));
      deleteBotMutation.mutate(
        {
          resource: 'bots',
          id: botId,
          invalidates: ['resourceAll'],
        },
        {
          onError: (error) => {
            uiLogger.error('Error deleting bot from project page:', error);
          },
          onSettled: () => {
            setDeletingBotIds((prev) => {
              const next = { ...prev };
              delete next[botId];
              return next;
            });
          },
        },
      );
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
          <Flex justify="space-between" align="center">
            <Flex vertical gap={2}>
              <Title level={4} className={styles.headerHeading}>
                <DesktopOutlined /> {projectTitle}
              </Title>
              <Text type="secondary" className={styles.headerSubtitle}>
                Accounts summary table
              </Text>
            </Flex>
          </Flex>
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
          <Space wrap className={styles.filtersSpace}>
            <Input
              placeholder="Search by ID, character, email, server..."
              prefix={<SearchOutlined />}
              size="small"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              className={styles.filterSearch}
              variant="filled"
            />
            <Select
              placeholder="Bot Status"
              size="small"
              value={statusFilter}
              onChange={(value) => updateStatusFilter(value as StatusFilter)}
              className={styles.filterStatus}
              variant="filled"
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
              size="small"
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
