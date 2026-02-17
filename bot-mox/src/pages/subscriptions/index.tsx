import React, { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Typography,
  message,
} from 'antd';
import {
  CreditCardOutlined,
  DownOutlined,
  PlusOutlined,
  ReloadOutlined,
  RightOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useSubscriptions } from '../../hooks/useSubscriptions';
import { SubscriptionForm } from '../../components/subscriptions/SubscriptionForm';
import { fetchBotsList } from '../../services/botsApiService';
import type {
  ComputedSubscriptionStatus,
  SubscriptionFormData,
  SubscriptionWithDetails,
} from '../../types';
import { buildSubscriptionColumns } from './subscription-columns';
import { ExpiringSubscriptionsAlert } from './ExpiringSubscriptionsAlert';
import { SubscriptionsStats } from './SubscriptionsStats';
import styles from './SubscriptionsPage.module.css';

const { Title, Text } = Typography;
const { Option } = Select;
const { confirm } = Modal;
const STATS_COLLAPSED_KEY = 'subscriptionsStatsCollapsed';

interface BotOption {
  id: string;
  name: string;
  character?: string;
  status: string;
  account_email?: string;
  vmName?: string;
}

export const SubscriptionsPage: React.FC = () => {
  const {
    subscriptions,
    loading,
    addSubscription,
    updateSubscription,
    deleteSubscription,
    getExpiringSoon,
    getExpired,
    getActive,
  } = useSubscriptions();

  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<ComputedSubscriptionStatus | 'all'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<SubscriptionWithDetails | null>(null);
  const [bots, setBots] = useState<BotOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [statsCollapsed, setStatsCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem(STATS_COLLAPSED_KEY);
    return saved ? Boolean(JSON.parse(saved)) : false;
  });

  useEffect(() => {
    localStorage.setItem(STATS_COLLAPSED_KEY, JSON.stringify(statsCollapsed));
  }, [statsCollapsed]);

  useEffect(() => {
    const loadBots = async () => {
      try {
        const botsData = await fetchBotsList();
        const botsList: BotOption[] = botsData.map((bot) => ({
          id: bot.id,
          name: bot.name || bot.id,
          character: bot.character?.name,
          status: bot.status,
          account_email:
            bot.account && typeof bot.account === 'object' && 'email' in bot.account
              ? String((bot.account as { email?: unknown }).email || '')
              : undefined,
          vmName: bot.vm?.name,
        }));
        setBots(botsList);
      } catch (error) {
        console.error('Error loading bots:', error);
      }
    };

    void loadBots();
  }, []);

  const filteredSubscriptions = subscriptions.filter((sub) => {
    const normalizedSearch = searchText.toLowerCase();
    const matchesSearch =
      sub.botName?.toLowerCase().includes(normalizedSearch) ||
      sub.botCharacter?.toLowerCase().includes(normalizedSearch) ||
      false;

    const matchesStatus = statusFilter === 'all' || sub.computedStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: subscriptions.length,
    active: getActive().length,
    expired: getExpired().length,
    expiringSoon: getExpiringSoon().length,
  };

  const handleDelete = (sub: SubscriptionWithDetails) => {
    confirm({
      title: 'Delete Subscription?',
      content: `Are you sure you want to delete ${sub.type.toUpperCase()} subscription for bot "${sub.botName || sub.bot_id}"?`,
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

  const openEditModal = (sub?: SubscriptionWithDetails) => {
    if (sub) {
      setEditingSubscription(sub);
    } else {
      setEditingSubscription(null);
    }
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
      setIsModalOpen(false);
      setEditingSubscription(null);
    } catch (error) {
      console.error('Error saving subscription:', error);
    } finally {
      setSaving(false);
    }
  };


  const rawColumns = buildSubscriptionColumns({
    onEdit: openEditModal,
    onDelete: handleDelete,
  });

  const columns = rawColumns.map((column) => ({
    ...column,
    onHeaderCell: () => ({ className: styles.tableHeaderCell }),
    onCell: () => ({ className: styles.tableCell }),
  }));

  const expiringSoon = getExpiringSoon().sort((a, b) => a.expires_at - b.expires_at);

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
            onChange={(event) => setSearchText(event.target.value)}
            style={{ width: 300 }}
          />
          <Select placeholder="Status" value={statusFilter} onChange={setStatusFilter} style={{ width: 150 }}>
            <Option value="all">All Statuses</Option>
            <Option value="active">Active</Option>
            <Option value="expiring_soon">Expiring Soon</Option>
            <Option value="expired">Expired</Option>
          </Select>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              setSearchText('');
              setStatusFilter('all');
            }}
          >
            Reset
          </Button>
        </Space>
      </Card>

      <Card className={styles.tableCard}>
        <Table
          dataSource={filteredSubscriptions}
          columns={columns}
          rowKey="id"
          loading={loading}
          rowClassName={() => styles.tableRow}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} subscriptions`,
          }}
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
