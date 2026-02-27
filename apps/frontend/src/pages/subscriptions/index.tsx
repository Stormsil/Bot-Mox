import {
  CreditCardOutlined,
  DownOutlined,
  PlusOutlined,
  ReloadOutlined,
  RightOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useModalForm, useTable } from '@refinedev/antd';
import { type HttpError, useDelete, useList } from '@refinedev/core';
import type { TableProps } from 'antd';
import { Button, Card, Input, Modal, message, Select, Space, Table, Typography } from 'antd';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { SubscriptionForm } from '../../components/subscriptions/SubscriptionForm';
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
const { confirm } = Modal;
const STATS_COLLAPSED_KEY = 'subscriptionsStatsCollapsed';

const RESOURCE_POLL_MS = 7_000;
const BOT_POLL_MS = 5_000;
const LARGE_PAGE_SIZE = 5_000;

export const SubscriptionsPage: React.FC = () => {
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
    syncWithLocation: true,
    pagination: {
      mode: 'server',
      pageSize: 10,
    },
    queryOptions: {
      refetchInterval: RESOURCE_POLL_MS,
    },
  });
  const allSubscriptionsList = useList<Subscription>({
    resource: 'subscriptions',
    pagination: {
      mode: 'server',
      currentPage: 1,
      pageSize: LARGE_PAGE_SIZE,
    },
    queryOptions: {
      refetchInterval: RESOURCE_POLL_MS,
    },
  });
  const createSubscriptionForm = useModalForm<Subscription, HttpError, Omit<Subscription, 'id'>>({
    resource: 'subscriptions',
    action: 'create',
    redirect: false,
    invalidates: ['resourceAll'],
    syncWithLocation: false,
  });
  const editSubscriptionForm = useModalForm<Subscription, HttpError, Partial<Subscription>>({
    resource: 'subscriptions',
    action: 'edit',
    redirect: false,
    invalidates: ['resourceAll'],
    syncWithLocation: false,
  });
  const deleteSubscriptionMutation = useDelete<Subscription>();

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
  const allSubscriptions = useMemo(
    () => allSubscriptionsList.result.data || [],
    [allSubscriptionsList.result.data],
  );

  const subscriptionsWithDetails = useMemo(
    () => enrichSubscriptionsWithDetails(tableSubscriptions, warningDays, botsMap),
    [tableSubscriptions, warningDays, botsMap],
  );
  const allSubscriptionsWithDetails = useMemo(
    () => enrichSubscriptionsWithDetails(allSubscriptions, warningDays, botsMap),
    [allSubscriptions, warningDays, botsMap],
  );
  const editingSubscription = useMemo(() => {
    if (editSubscriptionForm.id === undefined || editSubscriptionForm.id === null) {
      return null;
    }
    return (
      subscriptionsWithDetails.find((sub) => sub.id === String(editSubscriptionForm.id)) ?? null
    );
  }, [editSubscriptionForm.id, subscriptionsWithDetails]);

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

  const filteredSubscriptions = filterSubscriptionsByStatus(subscriptionsWithDetails, statusFilter);

  const stats = computeSubscriptionsStats(allSubscriptionsWithDetails);

  const loading =
    Boolean(subscriptionsTable.tableProps.loading) ||
    allSubscriptionsList.query.isLoading ||
    botsList.query.isLoading ||
    settingsQuery.isLoading ||
    createSubscriptionForm.formLoading ||
    editSubscriptionForm.formLoading;

  const handleDelete = (sub: SubscriptionWithDetails) => {
    confirm({
      title: 'Delete Subscription?',
      content: `Are you sure you want to delete ${sub.type.toUpperCase()} subscription for bot "${sub.botName || sub.bot_id}"?`,
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          const paginationConfig = subscriptionsTableProps.pagination;
          const currentPage = Number(
            paginationConfig && typeof paginationConfig === 'object'
              ? (paginationConfig.current ?? 1)
              : 1,
          );
          await deleteSubscriptionMutation.mutateAsync({
            resource: 'subscriptions',
            id: sub.id,
            invalidates: ['resourceAll'],
          });

          if (tableSubscriptions.length <= 1 && currentPage > 1) {
            (subscriptionsTable as { setCurrent?: (page: number) => void }).setCurrent?.(
              currentPage - 1,
            );
          }
          message.success('Subscription deleted');
        } catch (error) {
          uiLogger.error('Error deleting subscription:', error);
          message.error(`Error deleting subscription: ${getErrorMessage(error, 'Unknown error')}`);
        }
      },
    });
  };

  const handleCreateSubscription = async (data: SubscriptionFormData) => {
    try {
      await createSubscriptionForm.onFinish(toCreateSubscriptionPayload(data));
      createSubscriptionForm.close();
    } catch (error) {
      uiLogger.error('Error creating subscription:', error);
      message.error(`Error saving subscription: ${getErrorMessage(error, 'Unknown error')}`);
    }
  };

  const handleEditSubscription = async (data: SubscriptionFormData) => {
    if (!editingSubscription) {
      message.error('Subscription is not available for editing');
      return;
    }

    try {
      await editSubscriptionForm.onFinish(toUpdateSubscriptionPayload(data));
      editSubscriptionForm.close();
    } catch (error) {
      uiLogger.error('Error updating subscription:', error);
      message.error(`Error saving subscription: ${getErrorMessage(error, 'Unknown error')}`);
    }
  };

  const rawColumns = buildSubscriptionColumns({
    onEdit: (subscriptionId) => editSubscriptionForm.show(subscriptionId),
    onDelete: handleDelete,
  });
  const columns = rawColumns;

  const expiringSoon = getExpiringSoonSubscriptions(allSubscriptionsWithDetails);
  const subscriptionsTableProps =
    subscriptionsTable.tableProps as unknown as TableProps<SubscriptionWithDetails>;

  return (
    <div className={styles.root}>
      <Card className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerTitle}>
            <Title level={4} className={styles.headerMainTitle}>
              <CreditCardOutlined /> Subscriptions
            </Title>
            <Text type="secondary" className={styles.headerSubtitle}>
              Manage bot subscriptions
            </Text>
          </div>
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
        </div>
      </Card>

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
              subscriptionsTable.setFilters(buildTableFilters({ q: event.target.value }), 'replace')
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
        <Table
          {...subscriptionsTableProps}
          dataSource={filteredSubscriptions}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={
            subscriptionsTableProps.pagination &&
            typeof subscriptionsTableProps.pagination === 'object'
              ? {
                  ...subscriptionsTableProps.pagination,
                  current: Math.max(1, Number(subscriptionsTableProps.pagination.current) || 1),
                  pageSize: Math.max(1, Number(subscriptionsTableProps.pagination.pageSize) || 10),
                  showSizeChanger: true,
                  showTotal: (total) => `Total ${total} subscriptions`,
                }
              : {
                  pageSize: 10,
                  showSizeChanger: true,
                  showTotal: (total) => `Total ${total} subscriptions`,
                }
          }
          size="small"
        />
      </Card>

      <Modal
        {...createSubscriptionForm.modalProps}
        title="Add Subscription"
        footer={null}
        width={500}
      >
        <SubscriptionForm
          editingSubscription={null}
          bots={bots}
          onSave={handleCreateSubscription}
          onCancel={createSubscriptionForm.close}
          loading={createSubscriptionForm.formLoading}
        />
      </Modal>

      <Modal
        {...editSubscriptionForm.modalProps}
        title="Edit Subscription"
        footer={null}
        width={500}
      >
        <SubscriptionForm
          editingSubscription={editingSubscription}
          bots={bots}
          onSave={handleEditSubscription}
          onCancel={editSubscriptionForm.close}
          loading={editSubscriptionForm.formLoading}
        />
      </Modal>
    </div>
  );
};
