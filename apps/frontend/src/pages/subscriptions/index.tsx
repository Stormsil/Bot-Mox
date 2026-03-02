import {
  CreditCardOutlined,
  DownOutlined,
  PlusOutlined,
  ReloadOutlined,
  RightOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { List, useModalForm, useTable } from '@refinedev/antd';
import { type HttpError, useList } from '@refinedev/core';
import type { TableProps } from 'antd';
import { Button, Card, Input, message, Select, Space, Typography } from 'antd';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import type { BotRecord } from '../../entities/bot/model/types';
import { enrichSubscriptionsWithDetails } from '../../entities/resources/api/subscriptionFacade';
import type {
  ComputedSubscriptionStatus,
  Subscription,
  SubscriptionFormData,
  SubscriptionWithDetails,
} from '../../entities/resources/model/types';
import { getDefaultSettings } from '../../entities/settings/api/settingsFacade';
import { useSubscriptionSettingsQuery } from '../../entities/settings/api/useSubscriptionSettingsQuery';
import { uiLogger } from '../../observability/uiLogger';
import { AppModal, AppTable } from '../../shared/ui';
import { SubscriptionForm } from '../../widgets/subscriptions/SubscriptionForm';
import { ExpiringSubscriptionsAlert } from './ExpiringSubscriptionsAlert';
import styles from './SubscriptionsPage.module.css';
import { SubscriptionsStats } from './SubscriptionsStats';
import { buildSubscriptionColumns } from './subscription-columns';
import {
  type BotOption,
  buildTableFilters,
  computeSubscriptionsStats,
  filterSubscriptionsByStatus,
  getErrorMessage,
  getExpiringSoonSubscriptions,
  readFilterValue,
  toCreateSubscriptionPayload,
  toUpdateSubscriptionPayload,
} from './subscription-page.helpers';

const { Title, Text } = Typography;
const { Option } = Select;
const STATS_COLLAPSED_KEY = 'subscriptionsStatsCollapsed';

const BOT_POLL_MS = 5_000;
const LARGE_PAGE_SIZE = 5_000;

export const SubscriptionsPage: React.FC = () => {
  const syncWithLocationEnabled = !(typeof navigator !== 'undefined' && navigator.webdriver);

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
  const settingsQuery = useSubscriptionSettingsQuery();
  const subscriptionsTable = useTable<Subscription>({
    resource: 'subscriptions',
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
  const createSubscriptionForm = useModalForm<Subscription, HttpError, Omit<Subscription, 'id'>>({
    resource: 'subscriptions',
    action: 'create',
    autoSubmitClose: true,
    redirect: false,
    invalidates: ['resourceAll'],
    syncWithLocation: false,
    successNotification: () => ({
      message: 'Subscription created',
      type: 'success',
    }),
    errorNotification: (error) => ({
      message: `Error saving subscription: ${getErrorMessage(error, 'Unknown error')}`,
      type: 'error',
    }),
  });
  const editSubscriptionForm = useModalForm<Subscription, HttpError, Partial<Subscription>>({
    resource: 'subscriptions',
    action: 'edit',
    autoSubmitClose: true,
    redirect: false,
    invalidates: ['resourceAll'],
    syncWithLocation: false,
    successNotification: () => ({
      message: 'Subscription updated',
      type: 'success',
    }),
    errorNotification: (error) => ({
      message: `Error saving subscription: ${getErrorMessage(error, 'Unknown error')}`,
      type: 'error',
    }),
  });

  const [statusFilter, setStatusFilter] = useState<ComputedSubscriptionStatus | 'all'>('all');
  const [statsCollapsed, setStatsCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem(STATS_COLLAPSED_KEY);
    return saved ? Boolean(JSON.parse(saved)) : false;
  });

  const searchText = readFilterValue(subscriptionsTable.filters, 'q', '');
  const warningDays = settingsQuery.data?.warning_days ?? getDefaultSettings().warning_days;

  const botsMap = useMemo(() => {
    const nextBotsMap = new Map<
      string,
      {
        name: string;
        character?: string;
        status?: SubscriptionWithDetails['botStatus'];
        vmName?: string;
      }
    >();

    (botsList.result.data || []).forEach((bot) => {
      nextBotsMap.set(bot.id, {
        name: bot.name || bot.id,
        character: bot.character?.name,
        status: bot.status,
        vmName: bot.vm?.name,
      });
    });

    return nextBotsMap;
  }, [botsList.result.data]);

  const bots = useMemo<BotOption[]>(
    () =>
      (botsList.result.data || []).map((bot) => ({
        id: bot.id,
        name: bot.name || bot.id,
        character: bot.character?.name,
        status: String(bot.status || ''),
        account_email:
          bot.account && typeof bot.account === 'object' && 'email' in bot.account
            ? String((bot.account as { email?: unknown }).email || '')
            : undefined,
        vmName: bot.vm?.name,
      })),
    [botsList.result.data],
  );

  const tableSubscriptions = useMemo(
    () => (subscriptionsTable.tableProps.dataSource as Subscription[] | undefined) ?? [],
    [subscriptionsTable.tableProps.dataSource],
  );
  const subscriptionsWithDetails = useMemo(
    () => enrichSubscriptionsWithDetails(tableSubscriptions, warningDays, botsMap),
    [tableSubscriptions, warningDays, botsMap],
  );
  const editingSubscription = useMemo(() => {
    if (editSubscriptionForm.id === undefined || editSubscriptionForm.id === null) {
      return null;
    }
    return (
      subscriptionsWithDetails.find((sub) => sub.id === String(editSubscriptionForm.id)) ?? null
    );
  }, [editSubscriptionForm.id, subscriptionsWithDetails]);
  const createSubscriptionFormProps = useMemo(
    () => ({
      ...createSubscriptionForm.formProps,
      onFinish: async (values: SubscriptionFormData) =>
        createSubscriptionForm.onFinish(toCreateSubscriptionPayload(values)),
    }),
    [createSubscriptionForm.formProps, createSubscriptionForm.onFinish],
  );
  const editSubscriptionFormProps = useMemo(
    () => ({
      ...editSubscriptionForm.formProps,
      onFinish: async (values: SubscriptionFormData) =>
        editSubscriptionForm.onFinish(toUpdateSubscriptionPayload(values)),
    }),
    [editSubscriptionForm.formProps, editSubscriptionForm.onFinish],
  );

  useEffect(() => {
    localStorage.setItem(STATS_COLLAPSED_KEY, JSON.stringify(statsCollapsed));
  }, [statsCollapsed]);

  useEffect(() => {
    if (!botsList.query.error) {
      return;
    }
    uiLogger.error('Error loading bots:', botsList.query.error);
  }, [botsList.query.error]);

  useEffect(() => {
    if (!subscriptionsTable.tableQuery.error) {
      return;
    }
    uiLogger.error('Error loading subscriptions:', subscriptionsTable.tableQuery.error);
    message.error('Failed to load subscriptions');
  }, [subscriptionsTable.tableQuery.error]);

  useEffect(() => {
    if (
      !editSubscriptionForm.modalProps.open ||
      editSubscriptionForm.id === undefined ||
      editSubscriptionForm.id === null
    ) {
      return;
    }

    if (editingSubscription) {
      return;
    }

    editSubscriptionForm.close();
    message.warning('Subscription edit link is outdated. Opened list view instead.');
  }, [editSubscriptionForm, editingSubscription]);

  const filteredSubscriptions = filterSubscriptionsByStatus(subscriptionsWithDetails, statusFilter);

  const stats = computeSubscriptionsStats(subscriptionsWithDetails);

  const loading =
    Boolean(subscriptionsTable.tableProps.loading) ||
    botsList.query.isLoading ||
    settingsQuery.isLoading ||
    createSubscriptionForm.formLoading ||
    editSubscriptionForm.formLoading;

  const rawColumns = buildSubscriptionColumns({
    onEdit: (subscriptionId) => editSubscriptionForm.show(subscriptionId),
  });
  const columns = rawColumns;

  const expiringSoon = getExpiringSoonSubscriptions(subscriptionsWithDetails);
  const subscriptionsTableProps =
    subscriptionsTable.tableProps as unknown as TableProps<SubscriptionWithDetails>;

  return (
    <div className={styles.root}>
      <List
        wrapperProps={{ className: styles.header }}
        title={
          <div className={styles.headerTitle}>
            <Title level={4} className={styles.headerMainTitle}>
              <CreditCardOutlined /> Subscriptions
            </Title>
            <Text type="secondary" className={styles.headerSubtitle}>
              Manage bot subscriptions
            </Text>
          </div>
        }
        headerButtons={
          <Space>
            <Button
              type="text"
              icon={statsCollapsed ? <RightOutlined /> : <DownOutlined />}
              onClick={() => setStatsCollapsed((prev) => !prev)}
            >
              Stats
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => createSubscriptionForm.show()}
            >
              Add Subscription
            </Button>
          </Space>
        }
      >
        <ExpiringSubscriptionsAlert subscriptions={expiringSoon} />

        <SubscriptionsStats collapsed={statsCollapsed} stats={stats} />

        <Card className={styles.filters}>
          <Space wrap>
            <Input
              placeholder="Search by bot or character..."
              prefix={<SearchOutlined />}
              size="small"
              value={searchText}
              onChange={(event) =>
                subscriptionsTable.setFilters(
                  buildTableFilters({ q: event.target.value }),
                  'replace',
                )
              }
              style={{ width: 300 }}
            />
            <Select
              placeholder="Status"
              size="small"
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: 150 }}
            >
              <Option value="all">All Statuses</Option>
              <Option value="active">Active</Option>
              <Option value="expiring_soon">Expiring Soon</Option>
              <Option value="expired">Expired</Option>
            </Select>
            <Button
              icon={<ReloadOutlined />}
              size="small"
              onClick={() => {
                subscriptionsTable.setFilters([], 'replace');
                setStatusFilter('all');
              }}
            >
              Reset
            </Button>
          </Space>
        </Card>

        <Card className={styles.tableCard}>
          <AppTable
            {...subscriptionsTableProps}
            dataSource={filteredSubscriptions}
            columns={columns}
            rowKey="id"
            loading={loading}
            pagination={
              subscriptionsTableProps.pagination === false
                ? false
                : {
                    ...(subscriptionsTableProps.pagination &&
                    typeof subscriptionsTableProps.pagination === 'object'
                      ? subscriptionsTableProps.pagination
                      : {}),
                  }
            }
          />
        </Card>
      </List>

      <AppModal
        {...createSubscriptionForm.modalProps}
        title="Add Subscription"
        footer={null}
        width={500}
      >
        <SubscriptionForm
          editingSubscription={null}
          bots={bots}
          formProps={createSubscriptionFormProps}
          onCancel={createSubscriptionForm.close}
        />
      </AppModal>

      <AppModal
        {...editSubscriptionForm.modalProps}
        title="Edit Subscription"
        footer={null}
        width={500}
      >
        <SubscriptionForm
          editingSubscription={editingSubscription}
          bots={bots}
          formProps={editSubscriptionFormProps}
          onCancel={editSubscriptionForm.close}
        />
      </AppModal>
    </div>
  );
};
