import {
  CreditCardOutlined,
  DownOutlined,
  PlusOutlined,
  ReloadOutlined,
  RightOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useTable } from '@refinedev/antd';
import {
  type CrudFilter,
  type HttpError,
  useCreate,
  useDelete,
  useList,
  useUpdate,
} from '@refinedev/core';
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

const { Title, Text } = Typography;
const { Option } = Select;
const { confirm } = Modal;
const STATS_COLLAPSED_KEY = 'subscriptionsStatsCollapsed';

const RESOURCE_POLL_MS = 7_000;
const BOT_POLL_MS = 5_000;
const LARGE_PAGE_SIZE = 5_000;

interface BotOption {
  id: string;
  name: string;
  character?: string;
  status: string;
  account_email?: string;
  vmName?: string;
}

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

function buildTableFilters(values: { q: string }): CrudFilter[] {
  if (!values.q.trim()) {
    return [];
  }
  return [{ field: 'q', operator: 'eq', value: values.q.trim() }];
}

function parseDateToTimestamp(dateString: string): number {
  if (!dateString || typeof dateString !== 'string') {
    return Number.NaN;
  }

  const parts = dateString.split('.');
  if (parts.length !== 3) {
    return Number.NaN;
  }

  const [day, month, year] = parts.map(Number);
  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) {
    return Number.NaN;
  }

  return new Date(year, month - 1, day, 23, 59, 59, 999).getTime();
}

function toCreateSubscriptionPayload(data: SubscriptionFormData): Omit<Subscription, 'id'> {
  const expiresAtTimestamp = parseDateToTimestamp(data.expires_at);
  if (!Number.isFinite(expiresAtTimestamp)) {
    throw new Error(`Invalid expires_at format: ${data.expires_at}. Expected DD.MM.YYYY`);
  }

  const now = Date.now();
  return {
    type: data.type,
    status: 'active',
    expires_at: expiresAtTimestamp,
    created_at: now,
    updated_at: now,
    bot_id: data.bot_id,
    ...(data.account_email && { account_email: data.account_email }),
    auto_renew: data.auto_renew ?? false,
    ...(data.project_id && { project_id: data.project_id }),
    ...(data.notes && { notes: data.notes }),
  };
}

function toUpdateSubscriptionPayload(data: Partial<SubscriptionFormData>): Partial<Subscription> {
  const updates: Partial<Subscription> = {
    updated_at: Date.now(),
  };

  if (data.type !== undefined) updates.type = data.type;
  if (data.expires_at !== undefined) {
    const expiresAtTimestamp = parseDateToTimestamp(data.expires_at);
    if (!Number.isFinite(expiresAtTimestamp)) {
      throw new Error(`Invalid expires_at format: ${data.expires_at}. Expected DD.MM.YYYY`);
    }
    updates.expires_at = expiresAtTimestamp;
  }
  if (data.bot_id !== undefined) updates.bot_id = data.bot_id;
  if (data.account_email !== undefined) updates.account_email = data.account_email;
  if (data.auto_renew !== undefined) updates.auto_renew = data.auto_renew;
  if (data.project_id !== undefined) updates.project_id = data.project_id;
  if (data.notes !== undefined) updates.notes = data.notes;

  return updates;
}

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
  const createSubscriptionMutation = useCreate<Subscription, HttpError, Omit<Subscription, 'id'>>();
  const updateSubscriptionMutation = useUpdate<Subscription, HttpError, Partial<Subscription>>();
  const deleteSubscriptionMutation = useDelete<Subscription>();

  const [statusFilter, setStatusFilter] = useState<ComputedSubscriptionStatus | 'all'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<SubscriptionWithDetails | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
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

  const filteredSubscriptions = subscriptionsWithDetails.filter((sub) => {
    return statusFilter === 'all' || sub.computedStatus === statusFilter;
  });

  const stats = {
    total: allSubscriptionsWithDetails.length,
    active: allSubscriptionsWithDetails.filter((sub) => sub.computedStatus === 'active').length,
    expired: allSubscriptionsWithDetails.filter((sub) => sub.computedStatus === 'expired').length,
    expiringSoon: allSubscriptionsWithDetails.filter(
      (sub) => sub.computedStatus === 'expiring_soon',
    ).length,
  };

  const loading =
    Boolean(subscriptionsTable.tableProps.loading) ||
    allSubscriptionsList.query.isLoading ||
    botsList.query.isLoading ||
    settingsQuery.isLoading ||
    saving;

  const handleDelete = (sub: SubscriptionWithDetails) => {
    confirm({
      title: 'Delete Subscription?',
      content: `Are you sure you want to delete ${sub.type.toUpperCase()} subscription for bot "${sub.botName || sub.bot_id}"?`,
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await deleteSubscriptionMutation.mutateAsync({
            resource: 'subscriptions',
            id: sub.id,
            invalidates: ['resourceAll'],
          });
          message.success('Subscription deleted');
        } catch (error) {
          uiLogger.error('Error deleting subscription:', error);
          message.error('Error deleting subscription');
        }
      },
    });
  };

  const openEditModal = (sub?: SubscriptionWithDetails) => {
    setEditingSubscription(sub ?? null);
    setIsModalOpen(true);
  };

  const handleSaveSubscription = async (data: SubscriptionFormData) => {
    setSaving(true);
    try {
      if (editingSubscription) {
        await updateSubscriptionMutation.mutateAsync({
          resource: 'subscriptions',
          id: editingSubscription.id,
          values: toUpdateSubscriptionPayload(data),
          invalidates: ['resourceAll'],
        });
      } else {
        await createSubscriptionMutation.mutateAsync({
          resource: 'subscriptions',
          values: toCreateSubscriptionPayload(data),
          invalidates: ['resourceAll'],
        });
      }
      setIsModalOpen(false);
      setEditingSubscription(null);
    } catch (error) {
      uiLogger.error('Error saving subscription:', error);
      message.error('Error saving subscription');
    } finally {
      setSaving(false);
    }
  };

  const rawColumns = buildSubscriptionColumns({
    onEdit: openEditModal,
    onDelete: handleDelete,
    cellClassName: styles.tableCell,
    headerClassName: styles.tableHeaderCell,
  });

  const columns = rawColumns.map((column) => ({
    ...column,
    onHeaderCell: () => ({ className: styles.tableHeaderCell }),
    onCell: () => ({ className: styles.tableCell }),
  }));

  const expiringSoon = allSubscriptionsWithDetails
    .filter((sub) => sub.computedStatus === 'expiring_soon')
    .sort((a, b) => a.expires_at - b.expires_at);
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
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditModal()}>
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
            value={searchText}
            onChange={(event) =>
              subscriptionsTable.setFilters(buildTableFilters({ q: event.target.value }), 'replace')
            }
            style={{ width: 300 }}
          />
          <Select
            placeholder="Status"
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
          rowClassName={() => styles.tableRow}
          pagination={
            subscriptionsTableProps.pagination
              ? {
                  ...subscriptionsTableProps.pagination,
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
        title={editingSubscription ? 'Edit Subscription' : 'Add Subscription'}
        open={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false);
          setEditingSubscription(null);
        }}
        footer={null}
        width={500}
      >
        <SubscriptionForm
          editingSubscription={editingSubscription}
          bots={bots}
          onSave={handleSaveSubscription}
          onCancel={() => {
            setIsModalOpen(false);
            setEditingSubscription(null);
          }}
          loading={saving}
        />
      </Modal>
    </div>
  );
};
