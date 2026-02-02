import React, { useState, useEffect } from 'react';
import {
  Card,
  Typography,
  Tag,
  Button,
  Space,
  Alert,
  Spin,
  Empty,
  message,
  List,
  Modal,
} from 'antd';
import {
  CreditCardOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { useSubscriptions } from '../../hooks/useSubscriptions';
import { SubscriptionForm } from '../subscriptions/SubscriptionForm';
import type {
  Subscription,
  SubscriptionType,
  SubscriptionWithDetails,
  SubscriptionFormData,
  ComputedSubscriptionStatus,
} from '../../types';
import type { Bot } from '../../types';
import dayjs from 'dayjs';
import './BotSubscription.css';

const { Title, Text } = Typography;
const { confirm } = Modal;

// Interface for bot in dropdown
interface BotOption {
  id: string;
  name: string;
  character?: string;
  status: string;
  account_email?: string;
}

interface BotSubscriptionProps {
  bot: Bot;
}

// Subscription types with description
const SUBSCRIPTION_TYPES: { value: SubscriptionType; label: string; color: string }[] = [
  { value: 'wow', label: 'WoW', color: 'blue' },
  { value: 'bot', label: 'Bot', color: 'purple' },
  { value: 'proxy', label: 'Proxy', color: 'cyan' },
  { value: 'vpn', label: 'VPN', color: 'geekblue' },
  { value: 'other', label: 'Other', color: 'default' },
];

export const BotSubscription: React.FC<BotSubscriptionProps> = ({ bot }) => {
  // Use hook for bot subscriptions
  const {
    subscriptions,
    settings,
    loading,
    addSubscription,
    updateSubscription,
    deleteSubscription,
  } = useSubscriptions({ botId: bot.id });

  // Local states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<SubscriptionWithDetails | null>(null);
  const [saving, setSaving] = useState(false);
  const [botAccountEmail, setBotAccountEmail] = useState<string | null>(null);

  // Load bot account email
  useEffect(() => {
    const loadBotData = async () => {
      try {
        const { database } = await import('../../utils/firebase');
        const { ref, get } = await import('firebase/database');
        const botRef = ref(database, `bots/${bot.id}`);
        const snapshot = await get(botRef);

        if (snapshot.exists()) {
          const botData = snapshot.val();
          if (botData?.account?.email) {
            setBotAccountEmail(botData.account.email);
          }
        }
      } catch (error) {
        console.error('Error loading bot data:', error);
      }
    };

    loadBotData();
  }, [bot.id]);

  // Get status icon
  const getStatusIcon = (status: ComputedSubscriptionStatus) => {
    switch (status) {
      case 'expired':
        return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />;
      case 'expiring_soon':
        return <ClockCircleOutlined style={{ color: '#faad14' }} />;
      case 'active':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      default:
        return null;
    }
  };

  // Get status color
  const getStatusColor = (status: ComputedSubscriptionStatus) => {
    switch (status) {
      case 'expired':
        return 'error';
      case 'expiring_soon':
        return 'warning';
      case 'active':
        return 'success';
      default:
        return 'default';
    }
  };

  // Get status text
  const getStatusText = (sub: SubscriptionWithDetails) => {
    if (sub.computedStatus === 'expired') return 'Expired';
    if (sub.computedStatus === 'expiring_soon') return `Expires in ${sub.daysRemaining} days`;
    return 'Active';
  };

  // Get type color
  const getTypeColor = (type: SubscriptionType) => {
    return SUBSCRIPTION_TYPES.find((t) => t.value === type)?.color || 'default';
  };

  // Get type label
  const getTypeLabel = (type: SubscriptionType) => {
    return SUBSCRIPTION_TYPES.find((t) => t.value === type)?.label || type;
  };

  // Problem subscriptions
  const problemSubscriptions = subscriptions.filter(
    (sub) => sub.computedStatus === 'expired' || sub.computedStatus === 'expiring_soon'
  );

  // Open modal for creation
  const openCreateModal = () => {
    setEditingSubscription(null);
    // Small delay to ensure form is reset with presetBotId
    setTimeout(() => {
      setIsModalOpen(true);
    }, 0);
  };

  // Open modal for editing
  const openEditModal = (sub: SubscriptionWithDetails) => {
    setEditingSubscription(sub);
    setIsModalOpen(true);
  };

  // Save subscription
  const handleSaveSubscription = async (data: SubscriptionFormData) => {
    setSaving(true);
    try {
      if (editingSubscription) {
        await updateSubscription(editingSubscription.id, data);
      } else {
        await addSubscription(data);
      }
      setIsModalOpen(false);
      setEditingSubscription(null);
    } catch (error) {
      console.error('Error saving subscription:', error);
    } finally {
      setSaving(false);
    }
  };

  // Delete subscription
  const handleDelete = (sub: SubscriptionWithDetails) => {
    confirm({
      title: 'Delete Subscription?',
      content: `Are you sure you want to delete ${sub.type.toUpperCase()} subscription?`,
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await deleteSubscription(sub.id);
          message.success('Subscription deleted');
        } catch (error) {
          console.error('Error deleting subscription:', error);
          message.error('Error deleting subscription');
        }
      },
    });
  };

  // Build bot list (only current bot)
  const botOption: BotOption = {
    id: bot.id,
    name: bot.name,
    character: bot.character?.name,
    status: bot.status,
    account_email: botAccountEmail || undefined,
  };

  if (loading) {
    return (
      <div className="bot-subscription">
        <Card className="subscription-card">
          <Spin size="large" />
        </Card>
      </div>
    );
  }

  return (
    <div className="bot-subscription">
      {/* Alert for problem subscriptions */}
      {problemSubscriptions.length > 0 && (
        <Alert
          className="subscription-alert"
          message={
            <span>
              <WarningOutlined /> {problemSubscriptions.length} subscription(s) require attention
            </span>
          }
          description={
            <ul className="alert-list">
              {problemSubscriptions.map((sub) => (
                <li key={sub.id}>
                  <strong>{getTypeLabel(sub.type)}</strong> -{' '}
                  {sub.computedStatus === 'expired'
                    ? 'Expired'
                    : `Expires in ${sub.daysRemaining} days`}
                </li>
              ))}
            </ul>
          }
          type="warning"
          showIcon={false}
        />
      )}

      <Card
        className="subscription-card"
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
                <br />
                <Button
                  type="link"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={openCreateModal}
                >
                  Add Subscription
                </Button>
              </span>
            }
          />
        ) : (
          <List
            dataSource={subscriptions}
            renderItem={(sub) => (
              <List.Item
                className="subscription-item"
                actions={[
                  <Button
                    key="edit"
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => openEditModal(sub)}
                  />,
                  <Button
                    key="delete"
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleDelete(sub)}
                  />,
                ]}
              >
                <div className="subscription-item-content">
                  <div className="subscription-header">
                    <div className="subscription-type">
                      <Tag color={getStatusColor(sub.computedStatus)} icon={getStatusIcon(sub.computedStatus)}>
                        {getStatusText(sub)}
                      </Tag>
                    </div>
                    {sub.type === 'wow' && sub.auto_renew && (
                      <Tag color="success" style={{ fontSize: '10px' }}>
                        Auto-renewal
                      </Tag>
                    )}
                  </div>

                  {/* Show account binding for WoW subscriptions */}
                  {sub.type === 'wow' && sub.account_email && (
                    <div className="subscription-account" style={{ marginTop: 8 }}>
                      <Text type="secondary" style={{ fontSize: '11px' }}>
                        Account: {sub.account_email}
                      </Text>
                    </div>
                  )}

                  {/* Show notes if any */}
                  {sub.notes && (
                    <div className="subscription-notes" style={{ marginTop: 4 }}>
                      <Text type="secondary" style={{ fontSize: '11px' }}>
                        {sub.notes}
                      </Text>
                    </div>
                  )}

                  <div className="subscription-details">
                    <div className="detail-row">
                      <Text type="secondary">Expires:</Text>
                      <Text
                        strong
                        style={{
                          fontSize: '12px',
                          color: sub.isExpired
                            ? '#ff4d4f'
                            : sub.isExpiringSoon
                            ? '#faad14'
                            : undefined,
                        }}
                      >
                        {dayjs(sub.expires_at).format('DD.MM.YYYY')}
                      </Text>
                    </div>
                    <div className="detail-row">
                      <Text type="secondary">Created:</Text>
                      <Text style={{ fontSize: '12px' }}>{dayjs(sub.created_at).format('DD.MM.YYYY')}</Text>
                    </div>
                    <div className="detail-row">
                      <Text type="secondary">Days Left:</Text>
                      <Text
                        strong
                        style={{
                          fontSize: '12px',
                          color: sub.isExpired
                            ? '#ff4d4f'
                            : sub.isExpiringSoon
                            ? '#faad14'
                            : typeof sub.daysRemaining === 'number' && sub.daysRemaining <= 3
                            ? '#ff4d4f'
                            : typeof sub.daysRemaining === 'number' && sub.daysRemaining <= 7
                            ? '#faad14'
                            : '#52c41a',
                        }}
                      >
                        {sub.isExpired ? 0 : sub.daysRemaining}
                      </Text>
                    </div>
                  </div>

                  {(sub.isExpired || sub.isExpiringSoon) && (
                    <Alert
                      className="item-alert"
                      message={sub.isExpired ? 'Subscription expired' : 'Expiring soon'}
                      type={sub.isExpired ? 'error' : 'warning'}
                      showIcon
                      banner
                    />
                  )}
                </div>
              </List.Item>
            )}
          />
        )}
      </Card>

      {/* Модальное окно создания/редактирования */}
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
          presetBotId={bot.id}
          bots={[botOption]}
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
