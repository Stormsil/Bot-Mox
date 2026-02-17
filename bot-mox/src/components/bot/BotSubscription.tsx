import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Empty, List, Modal, Space, Spin, Typography, message } from 'antd';
import { CreditCardOutlined, PlusOutlined } from '@ant-design/icons';
import { useSubscriptions } from '../../hooks/useSubscriptions';
import { fetchBotById } from '../../services/botsApiService';
import {
  buildBotOption,
  isProblemSubscription,
  ProblemSubscriptionsAlert,
  SubscriptionListItem,
  SubscriptionModal,
} from './subscription';
import type { BotSubscriptionProps, SubscriptionFormData, SubscriptionWithDetails } from './subscription';
import styles from './subscription/subscription.module.css';

const { Text } = Typography;
const { confirm } = Modal;

export const BotSubscription: React.FC<BotSubscriptionProps> = ({ bot }) => {
  const {
    subscriptions,
    loading,
    addSubscription,
    updateSubscription,
    deleteSubscription,
  } = useSubscriptions({ botId: bot.id });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<SubscriptionWithDetails | null>(null);
  const [saving, setSaving] = useState(false);
  const [botAccountEmail, setBotAccountEmail] = useState<string | null>(null);

  useEffect(() => {
    const loadBotData = async () => {
      try {
        const botData = await fetchBotById(bot.id);
        if (botData?.account && typeof botData.account === 'object' && 'email' in botData.account) {
          const email = String((botData.account as { email?: unknown }).email || '').trim();
          if (email) {
            setBotAccountEmail(email);
          }
        }
      } catch (error) {
        console.error('Error loading bot data:', error);
      }
    };

    loadBotData();
  }, [bot.id]);

  const problemSubscriptions = useMemo(
    () => subscriptions.filter(isProblemSubscription),
    [subscriptions]
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
        await updateSubscription(editingSubscription.id, data);
      } else {
        await addSubscription(data);
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
          await deleteSubscription(subscription.id);
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
            <CreditCardOutlined />
            <span>Subscription</span>
          </Space>
        }
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
