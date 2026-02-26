import { CreditCardOutlined, PlusOutlined } from '@ant-design/icons';
import { type HttpError, useCreate, useDelete, useList, useUpdate } from '@refinedev/core';
import { Button, Card, Empty, List, Modal, message, Space, Spin, Typography } from 'antd';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useBotByIdQuery } from '../../entities/bot/api/useBotQueries';
import { enrichSubscriptionsWithDetails } from '../../entities/resources/api/subscriptionFacade';
import type { Subscription } from '../../entities/resources/model/types';
import { getDefaultSettings } from '../../entities/settings/api/settingsFacade';
import { useSubscriptionSettingsQuery } from '../../entities/settings/api/useSubscriptionSettingsQuery';
import type {
  BotSubscriptionProps,
  SubscriptionFormData,
  SubscriptionWithDetails,
} from './subscription';
import {
  buildBotOption,
  isProblemSubscription,
  ProblemSubscriptionsAlert,
  SubscriptionListItem,
  SubscriptionModal,
} from './subscription';
import styles from './subscription/subscription.module.css';

const { Text } = Typography;
const { confirm } = Modal;
const RESOURCE_REFETCH_INTERVAL_MS = 7_000;
const RESOURCE_LIST_PAGE_SIZE = 5_000;

function parseDateToTimestamp(dateString: string): number {
  const parts = String(dateString || '').split('.');
  if (parts.length !== 3) return Number.NaN;
  const [day, month, year] = parts.map(Number);
  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) {
    return Number.NaN;
  }
  return new Date(year, month - 1, day, 23, 59, 59, 999).getTime();
}

export const BotSubscription: React.FC<BotSubscriptionProps> = ({ bot }) => {
  const subscriptionsList = useList<Subscription>({
    resource: 'subscriptions',
    pagination: { mode: 'server', currentPage: 1, pageSize: RESOURCE_LIST_PAGE_SIZE },
    filters: [{ field: 'bot_id', operator: 'eq', value: bot.id }],
    queryOptions: { refetchInterval: RESOURCE_REFETCH_INTERVAL_MS },
  });
  const settingsQuery = useSubscriptionSettingsQuery();
  const createSubscriptionMutation = useCreate<Subscription, HttpError, Omit<Subscription, 'id'>>();
  const updateSubscriptionMutation = useUpdate<Subscription, HttpError, Partial<Subscription>>();
  const deleteSubscriptionMutation = useDelete<Subscription>();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<SubscriptionWithDetails | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [botAccountEmail, setBotAccountEmail] = useState<string | null>(null);
  const botQuery = useBotByIdQuery(bot.id);
  const warningDays = settingsQuery.data?.warning_days ?? getDefaultSettings().warning_days;

  const subscriptions = useMemo(() => {
    const vmName =
      'vm' in bot && bot.vm && typeof bot.vm === 'object' && 'name' in bot.vm
        ? String((bot.vm as { name?: unknown }).name || '')
        : undefined;
    const botsMap = new Map([
      [
        bot.id,
        {
          name: bot.name || bot.id,
          character: bot.character?.name,
          status: bot.status,
          vmName,
        },
      ],
    ]);
    return enrichSubscriptionsWithDetails(
      subscriptionsList.result.data || [],
      warningDays,
      botsMap,
    );
  }, [bot, subscriptionsList.result.data, warningDays]);
  const loading = subscriptionsList.query.isLoading || settingsQuery.isLoading;

  useEffect(() => {
    if (!subscriptionsList.query.error) return;
    console.error('Error loading subscriptions:', subscriptionsList.query.error);
    message.error('Failed to load subscriptions');
  }, [subscriptionsList.query.error]);

  useEffect(() => {
    if (!botQuery.data?.account || typeof botQuery.data.account !== 'object') {
      setBotAccountEmail(null);
      return;
    }
    const email = String((botQuery.data.account as { email?: unknown }).email || '').trim();
    setBotAccountEmail(email || null);
  }, [botQuery.data]);

  const problemSubscriptions = useMemo(
    () => subscriptions.filter(isProblemSubscription),
    [subscriptions],
  );

  const botOption = useMemo(() => buildBotOption(bot, botAccountEmail), [bot, botAccountEmail]);

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingSubscription(null);
  };

  const openCreateModal = () => {
    setEditingSubscription(null);
    setTimeout(() => {
      setIsModalOpen(true);
    }, 0);
  };

  const openEditModal = (subscription: SubscriptionWithDetails) => {
    setEditingSubscription(subscription);
    setIsModalOpen(true);
  };

  const handleSaveSubscription = async (data: SubscriptionFormData) => {
    setSaving(true);
    try {
      if (editingSubscription) {
        const expiresAt = parseDateToTimestamp(data.expires_at);
        if (!Number.isFinite(expiresAt)) {
          throw new Error('Invalid expires_at format');
        }
        await updateSubscriptionMutation.mutateAsync({
          resource: 'subscriptions',
          id: editingSubscription.id,
          values: {
            bot_id: data.bot_id,
            type: data.type,
            expires_at: expiresAt,
            account_email: data.account_email,
            auto_renew: data.auto_renew,
            project_id: data.project_id,
            notes: data.notes,
            updated_at: Date.now(),
          },
          invalidates: ['resourceAll'],
        });
      } else {
        const expiresAt = parseDateToTimestamp(data.expires_at);
        if (!Number.isFinite(expiresAt)) {
          throw new Error('Invalid expires_at format');
        }
        const now = Date.now();
        await createSubscriptionMutation.mutateAsync({
          resource: 'subscriptions',
          values: {
            bot_id: data.bot_id,
            type: data.type,
            status: 'active',
            expires_at: expiresAt,
            created_at: now,
            updated_at: now,
            ...(data.account_email && { account_email: data.account_email }),
            auto_renew: data.auto_renew ?? false,
            ...(data.project_id && { project_id: data.project_id }),
            ...(data.notes && { notes: data.notes }),
          },
          invalidates: ['resourceAll'],
        });
      }
      closeModal();
    } catch (error) {
      console.error('Error saving subscription:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (subscription: SubscriptionWithDetails) => {
    confirm({
      title: 'Delete Subscription?',
      content: `Are you sure you want to delete ${subscription.type.toUpperCase()} subscription?`,
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await deleteSubscriptionMutation.mutateAsync({
            resource: 'subscriptions',
            id: subscription.id,
            invalidates: ['resourceAll'],
          });
          message.success('Subscription deleted');
        } catch (error) {
          console.error('Error deleting subscription:', error);
          message.error('Error deleting subscription');
        }
      },
    });
  };

  if (loading) {
    return (
      <div className={styles['bot-subscription']}>
        <Card className={styles['subscription-card']}>
          <Spin size="large" />
        </Card>
      </div>
    );
  }

  return (
    <div className={styles['bot-subscription']}>
      <ProblemSubscriptionsAlert subscriptions={problemSubscriptions} />

      <Card
        className={styles['subscription-card']}
        title={
          <Space>
            <CreditCardOutlined className={styles['card-title-icon']} />
            <span className={styles['card-title']}>Subscription</span>
          </Space>
        }
        styles={{
          header: {
            background: 'var(--boxmox-color-surface-muted)',
            borderBottom: '1px solid var(--boxmox-color-border-default)',
          },
          body: {
            padding: 0,
          },
        }}
        extra={
          <Button type="primary" size="small" icon={<PlusOutlined />} onClick={openCreateModal}>
            Add
          </Button>
        }
      >
        {subscriptions.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span>
                <Text type="secondary">No subscription for this bot</Text>
              </span>
            }
          />
        ) : (
          <List
            className={styles['subscription-list']}
            dataSource={subscriptions}
            renderItem={(subscription) => (
              <SubscriptionListItem
                subscription={subscription}
                onEdit={openEditModal}
                onDelete={handleDelete}
              />
            )}
          />
        )}
      </Card>

      <SubscriptionModal
        open={isModalOpen}
        editingSubscription={editingSubscription}
        presetBotId={bot.id}
        botOption={botOption}
        loading={saving}
        onSave={handleSaveSubscription}
        onCancel={closeModal}
      />
    </div>
  );
};
