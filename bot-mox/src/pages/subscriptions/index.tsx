import React, { useState, useEffect } from 'react';
import {
  Table,
  Card,
  Input,
  Select,
  Button,
  Tag,
  Space,
  Typography,
  Tooltip,
  Modal,
  Alert,
  message,
  Row,
  Col,
  Form,
  InputNumber,
} from 'antd';
  import {
  SearchOutlined,
  ReloadOutlined,
  CreditCardOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  WarningOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  RobotOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useSubscriptions } from '../../hooks/useSubscriptions';
import { SubscriptionForm } from '../../components/subscriptions/SubscriptionForm';
import type {
  SubscriptionWithDetails,
  ComputedSubscriptionStatus,
  SubscriptionFormData,
} from '../../types';
import dayjs from 'dayjs';
import './SubscriptionsPage.css';

const { Title, Text } = Typography;
const { Option } = Select;
const { confirm } = Modal;

// Interface for bot in dropdown
interface BotOption {
  id: string;
  name: string;
  character?: string;
  status: string;
  account_email?: string;
  vmName?: string;
}

export const SubscriptionsPage: React.FC = () => {
  // Use hook for subscriptions management
  const {
    subscriptions,
    settings,
    loading,
    addSubscription,
    updateSubscription,
    deleteSubscription,
    updateSettings,
    filterByStatus,
    getExpiringSoon,
    getExpired,
    getActive,
  } = useSubscriptions();

  // Local states
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<ComputedSubscriptionStatus | 'all'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<SubscriptionWithDetails | null>(null);
  const [bots, setBots] = useState<BotOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [settingsForm] = Form.useForm();

  // Load bots list
  useEffect(() => {
    const loadBots = async () => {
      try {
        const { database } = await import('../../utils/firebase');
        const { ref, get } = await import('firebase/database');
        const botsRef = ref(database, 'bots');
        const snapshot = await get(botsRef);

        if (snapshot.exists()) {
          const botsData = snapshot.val();
          const botsList: BotOption[] = Object.entries(botsData).map(([id, data]: [string, any]) => ({
            id,
            name: data.name || id,
            character: data.character?.name,
            status: data.status,
            account_email: data.account?.email,
            vmName: data.vm?.name,
          }));
          setBots(botsList);
        }
      } catch (error) {
        console.error('Error loading bots:', error);
      }
    };

    loadBots();
  }, []);

  // Update settings form when settings change
  useEffect(() => {
    settingsForm.setFieldsValue({
      warning_days: settings.warning_days,
    });
  }, [settings, settingsForm]);

  // Filter subscriptions
  const filteredSubscriptions = subscriptions.filter((sub) => {
    const matchesSearch =
      sub.botName?.toLowerCase().includes(searchText.toLowerCase()) ||
      sub.botCharacter?.toLowerCase().includes(searchText.toLowerCase()) ||
      false;

    const matchesStatus = statusFilter === 'all' || sub.computedStatus === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Статистика - используем методы из хука
  const stats = {
    total: subscriptions.length,
    active: getActive().length,
    expired: getExpired().length,
    expiringSoon: getExpiringSoon().length,
  };

  // Получение иконки статуса
  const getStatusIcon = (status: ComputedSubscriptionStatus) => {
    switch (status) {
      case 'expired':
        return <ExclamationCircleOutlined />;
      case 'expiring_soon':
        return <ClockCircleOutlined />;
      case 'active':
        return <CheckCircleOutlined />;
      default:
        return null;
    }
  };

  // Получение цвета статуса
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
  const getStatusText = (status: ComputedSubscriptionStatus) => {
    switch (status) {
      case 'expired':
        return 'Expired';
      case 'expiring_soon':
        return 'Expiring Soon';
      case 'active':
        return 'Active';
      default:
        return status;
    }
  };



  // Delete subscription
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

  // Open modal for create/edit
  const openEditModal = (sub?: SubscriptionWithDetails) => {
    if (sub) {
      setEditingSubscription(sub);
    } else {
      setEditingSubscription(null);
    }
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

  // Save settings
  const handleSaveSettings = async (values: { warning_days: number }) => {
    try {
      await updateSettings({ warning_days: values.warning_days });
      setIsSettingsModalOpen(false);
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  // Table columns
  const columns = [
    {
      title: 'Status',
      dataIndex: 'computedStatus',
      key: 'computedStatus',
      width: 140,
      render: (status: ComputedSubscriptionStatus, record: SubscriptionWithDetails) => (
        <Tag
          color={getStatusColor(status)}
          icon={getStatusIcon(status)}
          style={{ fontSize: '11px' }}
        >
          {getStatusText(status)}
          {status === 'expiring_soon' && ` (${record.daysRemaining} days)`}
        </Tag>
      ),
    },
    {
      title: 'Bot',
      key: 'bot',
      width: 200,
      render: (_: any, record: SubscriptionWithDetails) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: '12px', fontWeight: 500 }}>
            <RobotOutlined style={{ marginRight: 4 }} />
            {record.bot_id}
          </Text>
          <Text type="secondary" style={{ fontSize: '11px' }}>
            {record.botCharacter || record.botName}
            {record.botVmName && ` (${record.botVmName})`}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Expires',
      dataIndex: 'expires_at',
      key: 'expires_at',
      width: 130,
      render: (expiresAt: number, record: SubscriptionWithDetails) => {
        return (
          <div>
            <Text
              style={{
                color: record.isExpired
                  ? '#ff4d4f'
                  : record.isExpiringSoon
                  ? '#faad14'
                  : undefined,
                fontSize: '12px',
              }}
            >
              {dayjs(expiresAt).format('DD.MM.YYYY')}
            </Text>
          </div>
        );
      },
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 100,
      render: (createdAt: number) => (
        <Text style={{ fontSize: '12px' }}>{dayjs(createdAt).format('DD.MM.YYYY')}</Text>
      ),
    },
    {
      title: 'Days Left',
      key: 'days_left',
      width: 100,
      render: (_: any, record: SubscriptionWithDetails) => {
        if (record.isExpired) {
          return (
            <Text style={{ color: '#ff4d4f', fontSize: '14px', fontWeight: 600 }}>
              0
            </Text>
          );
        }
        
        // Определяем цвет в зависимости от количества дней
        let color = '#52c41a'; // Зелёный (> 7 дней)
        if (record.daysRemaining <= 3) {
          color = '#ff4d4f'; // Красный (<= 3 дней)
        } else if (record.daysRemaining <= 7) {
          color = '#faad14'; // Оранжевый (<= 7 дней)
        }
        
        return (
          <Text
            style={{
              color: color,
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            {record.daysRemaining}
          </Text>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_: any, record: SubscriptionWithDetails) => (
        <Space size="small">
          <Tooltip title="Edit">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => openEditModal(record)}
            />
          </Tooltip>
          <Tooltip title="Delete">
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // Expiring subscriptions
  const expiringSoon = getExpiringSoon().sort((a, b) => a.expires_at - b.expires_at);

  return (
    <div className="subscriptions-page">
      {/* Header */}
      <Card className="subscriptions-header">
        <div className="header-content">
          <div className="header-title">
            <Title level={4}>
              <CreditCardOutlined /> Subscriptions
            </Title>
            <Text type="secondary">Manage bot subscriptions</Text>
          </div>
          <Space>
            <Button icon={<SettingOutlined />} onClick={() => setIsSettingsModalOpen(true)}>
              Settings
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditModal()}>
              Add Subscription
            </Button>
          </Space>
        </div>
      </Card>

      {/* Statistics */}
      <Row gutter={16} className="subscriptions-stats">
        <Col span={6}>
          <Card className="stat-card">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stat-card active">
            <div className="stat-value">{stats.active}</div>
            <div className="stat-label">Active</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stat-card warning">
            <div className="stat-value">{stats.expiringSoon}</div>
            <div className="stat-label">Expiring Soon</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stat-card expired">
            <div className="stat-value">{stats.expired}</div>
            <div className="stat-label">Expired</div>
          </Card>
        </Col>
      </Row>

      {/* Expiring subscriptions warning */}
      {expiringSoon.length > 0 && (
        <Alert
          className="expiring-alert"
          message={
            <span>
              <WarningOutlined /> {expiringSoon.length} subscription(s) expiring soon
            </span>
          }
          description={
            <ul className="expiring-list">
              {expiringSoon.slice(0, 5).map((sub) => (
                <li key={sub.id}>
                  <strong>{sub.botName || sub.bot_id}</strong> - {sub.type.toUpperCase()} expires in{' '}
                  {sub.daysRemaining} days ({dayjs(sub.expires_at).format('DD.MM.YYYY')})
                </li>
              ))}
              {expiringSoon.length > 5 && (
                <li>...and {expiringSoon.length - 5} more</li>
              )}
            </ul>
          }
          type="warning"
          showIcon={false}
        />
      )}

      {/* Filters */}
      <Card className="subscriptions-filters">
        <Space wrap>
          <Input
            placeholder="Search by bot or character..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
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
              setSearchText('');
              setStatusFilter('all');
            }}
          >
            Reset
          </Button>
        </Space>
      </Card>

      {/* Table */}
      <Card className="subscriptions-table-card">
        <Table
          dataSource={filteredSubscriptions}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} subscriptions`,
          }}
          size="small"
        />
      </Card>

      {/* Create/Edit Modal */}
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

      {/* Settings Modal */}
      <Modal
        title="Subscription Settings"
        open={isSettingsModalOpen}
        onCancel={() => setIsSettingsModalOpen(false)}
        onOk={() => settingsForm.submit()}
        okText="Save"
        cancelText="Cancel"
        width={400}
      >
        <Form
          form={settingsForm}
          layout="vertical"
          onFinish={handleSaveSettings}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="warning_days"
            label="Warn before (days)"
            rules={[
              { required: true, message: 'Enter number of days' },
              { type: 'number', min: 1, max: 90, message: 'From 1 to 90 days' },
            ]}
            tooltip="How many days before expiration to show warning"
          >
            <InputNumber
              min={1}
              max={90}
              style={{ width: '100%' }}
              placeholder="e.g.: 7"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
