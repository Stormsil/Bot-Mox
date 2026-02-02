import React, { useState, useEffect } from 'react';
import {
  Table, Card, Input, Select, Button, Tag, Space, Typography, Tooltip,
  Badge, Modal, Form, DatePicker, message, AutoComplete, Popconfirm, Popover
} from 'antd';
import {
  SearchOutlined, ReloadOutlined, KeyOutlined,
  DeleteOutlined, EditOutlined, PlusOutlined, CopyOutlined,
  RobotOutlined, PlusCircleOutlined, EllipsisOutlined
} from '@ant-design/icons';
import { ref, onValue, update, remove, push, set } from 'firebase/database';
import { database } from '../../utils/firebase';
import type { BotLicense, LicenseWithBots } from '../../types';
import dayjs from 'dayjs';
import './LicensesPage.css';

const { Title, Text } = Typography;
const { Option } = Select;

export const LicensesPage: React.FC = () => {
  const [licenses, setLicenses] = useState<LicenseWithBots[]>([]);
  const [bots, setBots] = useState<Record<string, { 
    character?: { name: string }; 
    vm?: { name: string };
    name?: string;
  }>>({});

  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddBotModalOpen, setIsAddBotModalOpen] = useState(false);
  const [editingLicense, setEditingLicense] = useState<LicenseWithBots | null>(null);
  const [selectedLicenseForBot, setSelectedLicenseForBot] = useState<LicenseWithBots | null>(null);
  const [form] = Form.useForm();
  const [addBotForm] = Form.useForm();

  // Загрузка данных из Firebase
  useEffect(() => {
    console.log('[DEBUG] Starting Firebase data load...');
    const licensesRef = ref(database, 'bot_licenses');
    const botsRef = ref(database, 'bots');

    const unsubscribeLicenses = onValue(licensesRef, (snapshot) => {
      console.log('[DEBUG] Licenses loaded:', snapshot.exists());
      const data = snapshot.val();
      if (data) {
        const licensesList = Object.entries(data).map(([id, value]) => ({
          id,
          ...(value as Omit<BotLicense, 'id'>),
        })) as LicenseWithBots[];
        console.log('[DEBUG] Licenses count:', licensesList.length);
        console.log('[DEBUG] First license:', licensesList[0]);
        setLicenses(licensesList);
      } else {
        console.log('[DEBUG] No licenses found');
        setLicenses([]);
      }
      setLoading(false);
    }, (error) => {
      console.error('[DEBUG] Error loading licenses:', error);
      message.error('Failed to load licenses');
      setLoading(false);
    });

    const unsubscribeBots = onValue(botsRef, (snapshot) => {
      console.log('[DEBUG] Bots loaded:', snapshot.exists());
      const data = snapshot.val();
      if (data) {
        console.log('[DEBUG] Bots count:', Object.keys(data).length);
        setBots(data);
      } else {
        console.log('[DEBUG] No bots found');
        setBots({});
      }
    });

    return () => {
      unsubscribeLicenses();
      unsubscribeBots();
    };
  }, []);

  // Обогащаем лицензии данными о ботах
  useEffect(() => {
    console.log('[DEBUG] Enriching licenses with bots data...');
    console.log('[DEBUG] Bots available:', Object.keys(bots).length);
    console.log('[DEBUG] Licenses count:', licenses.length);
    
    if (Object.keys(bots).length > 0 && licenses.length > 0) {
      // Проверяем, нужно ли обновление
      const needsUpdate = licenses.some(license => {
        const currentBotIds = (license.bot_ids || []).sort().join(',');
        const enrichedBotIds = (license.botDetails?.map(b => b.id) || []).sort().join(',');
        return currentBotIds !== enrichedBotIds;
      });
      
      if (!needsUpdate) {
        console.log('[DEBUG] No update needed, skipping...');
        return;
      }
      
      const updatedLicenses = licenses.map(license => {
        console.log('[DEBUG] Processing license:', license.id, 'bot_ids:', license.bot_ids);
        const botDetails = (license.bot_ids || []).map((botId) => {
          const bot = bots[botId];
          console.log('[DEBUG] Looking up bot:', botId, 'found:', !!bot, 'bot data:', bot);
          const characterName = bot?.character?.name;
          const vmName = bot?.vm?.name;
          const botName = bot?.name || botId.substring(0, 8);
          return {
            id: botId,
            name: characterName || botName,
            characterName,
            vmName,
            fullDisplay: characterName 
              ? vmName ? `${characterName} (${vmName})` : characterName
              : botName,
          };
        });
        console.log('[DEBUG] License', license.id, 'botDetails:', botDetails);
        return { ...license, botDetails };
      });
      console.log('[DEBUG] Setting enriched licenses:', updatedLicenses);
      setLicenses(updatedLicenses);
    }
  }, [bots, licenses]);

  // Фильтрация лицензий
  const filteredLicenses = licenses.filter(license => {
    const matchesSearch = 
      license.key.toLowerCase().includes(searchText.toLowerCase()) ||
      license.botDetails?.some(bot => bot.name?.toLowerCase().includes(searchText.toLowerCase())) ||
      license.botDetails?.some(bot => bot.characterName?.toLowerCase().includes(searchText.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || license.status === statusFilter;
    const matchesType = typeFilter === 'all' || license.type === typeFilter;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  // Проверка истечения срока
  const isExpired = (expiresAt: number) => {
    return Date.now() > expiresAt;
  };

  // ИЗМЕНЕНО: 3 дня вместо 7
  const isExpiringSoon = (expiresAt: number) => {
    const daysUntilExpiry = Math.ceil((expiresAt - Date.now()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 3 && daysUntilExpiry > 0;
  };

  // Копирование ключа
  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    message.success('License key copied');
  };

  // Удаление лицензии
  const handleDelete = async (license: LicenseWithBots) => {
    try {
      await remove(ref(database, `bot_licenses/${license.id}`));
      message.success('License deleted');
    } catch (error) {
      console.error('Error deleting license:', error);
      message.error('Failed to delete license');
    }
  };

  // Создание/редактирование лицензии
  const handleSave = async (values: any) => {
    try {
      // Автоматически определяем статус на основе даты истечения
      const expiresAt = values.expires_at.valueOf();
      const isExpired = Date.now() > expiresAt;
      const status = isExpired ? 'expired' : 'active';

      const licenseData = {
        key: values.key,
        type: values.type,
        status: status,
        bot_ids: editingLicense?.bot_ids || [],
        expires_at: expiresAt,
        updated_at: Date.now(),
      };

      if (editingLicense) {
        await update(ref(database, `bot_licenses/${editingLicense.id}`), licenseData);
        message.success('License updated');
      } else {
        const newRef = push(ref(database, 'bot_licenses'));
        await set(newRef, {
          ...licenseData,
          created_at: Date.now(),
        });
        message.success('License created');
      }

      setIsModalOpen(false);
      setEditingLicense(null);
      form.resetFields();
    } catch (error) {
      console.error('Error saving license:', error);
      message.error('Failed to save license');
    }
  };

  // Добавление бота к лицензии
  const handleAddBot = async (values: any) => {
    console.log('[DEBUG] handleAddBot called with values:', values);
    if (!selectedLicenseForBot) {
      console.log('[DEBUG] No selected license, returning');
      return;
    }

    try {
      const botId = values.bot_id;
      console.log('[DEBUG] Adding bot:', botId, 'to license:', selectedLicenseForBot.id);

      // Обновляем лицензию - добавляем только bot_id
      const currentBotIds = selectedLicenseForBot.bot_ids || [];
      console.log('[DEBUG] Current bot_ids:', currentBotIds);

      await update(ref(database, `bot_licenses/${selectedLicenseForBot.id}`), {
        bot_ids: [...currentBotIds, botId],
        updated_at: Date.now(),
      });

      console.log('[DEBUG] Bot added successfully');
      message.success('Bot added to license');
      setIsAddBotModalOpen(false);
      setSelectedLicenseForBot(null);
      addBotForm.resetFields();
    } catch (error) {
      console.error('[DEBUG] Error adding bot:', error);
      message.error('Failed to add bot');
    }
  };

  // Удаление бота из лицензии
  const handleRemoveBot = async (license: LicenseWithBots, botIndex: number) => {
    try {
      const newBotIds = [...(license.bot_ids || [])];
      
      newBotIds.splice(botIndex, 1);

      await update(ref(database, `bot_licenses/${license.id}`), {
        bot_ids: newBotIds,
        updated_at: Date.now(),
      });

      message.success('Bot removed from license');
    } catch (error) {
      console.error('Error removing bot:', error);
      message.error('Failed to remove bot');
    }
  };

  // Открытие модалки добавления бота
  const openAddBotModal = (license: LicenseWithBots) => {
    console.log('[DEBUG] Opening Add Bot modal for license:', license.id);
    console.log('[DEBUG] Available bots:', Object.keys(bots));
    setSelectedLicenseForBot(license);
    addBotForm.resetFields();
    setIsAddBotModalOpen(true);
    console.log('[DEBUG] Modal state set to open');
  };

  // Открытие модалки редактирования
  const openEditModal = (license?: LicenseWithBots) => {
    if (license) {
      setEditingLicense(license);
      form.setFieldsValue({
        key: license.key,
        type: license.type,
        expires_at: dayjs(license.expires_at),
      });
    } else {
      setEditingLicense(null);
      form.resetFields();
      form.setFieldsValue({
        expires_at: dayjs().add(30, 'days'),
      });
    }
    setIsModalOpen(true);
  };

  // Рендер содержимого поповера со всеми ботами
  const renderBotsPopover = (record: LicenseWithBots) => {
    return (
      <div style={{ maxWidth: 300, maxHeight: 400, overflow: 'auto' }}>
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          {record.botDetails?.map((bot, index) => (
            <div key={bot.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <RobotOutlined style={{ color: 'var(--proxmox-accent)' }} />
                  <Text style={{ fontSize: '12px', fontWeight: 500 }}>
                    {bot.name}
                  </Text>
                </div>
                <Text type="secondary" style={{ fontSize: '11px', paddingLeft: 24 }}>
                  {bot.id.substring(0, 8)}...
                  {bot.vmName && ` (${bot.vmName})`}
                </Text>
              </div>
              <Button
                size="small"
                type="text"
                danger
                onClick={() => handleRemoveBot(record, index)}
                style={{ padding: '0 4px', minWidth: 'auto' }}
              >
                ×
              </Button>
            </div>
          ))}
        </Space>
      </div>
    );
  };

  // Колонки таблицы
  const columns = [
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string, record: LicenseWithBots) => {
        let color = 'default';

        if (isExpired(record.expires_at)) {
          color = 'error';
        } else if (isExpiringSoon(record.expires_at)) {
          color = 'warning';
        } else if (status === 'active') {
          color = 'success';
        } else if (status === 'revoked') {
          color = 'red';
        }

        return (
          <Badge
            status={color as any}
            text={
              <Tag color={color}>
                {isExpired(record.expires_at) ? 'expired' : status}
              </Tag>
            }
          />
        );
      },
    },
    {
      title: 'License Key',
      dataIndex: 'key',
      key: 'key',
      render: (key: string, record: LicenseWithBots) => (
        <Space direction="vertical" size={0}>
          <Text copyable={{ text: key, icon: <CopyOutlined /> }} className="license-key" style={{ fontSize: '12px' }}>
            {key}
          </Text>
          {record.type && (
            <Text type="secondary" style={{ fontSize: '11px' }}>
              {record.type}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Bot',
      key: 'bot',
      width: 400,
      render: (_: any, record: LicenseWithBots) => {
        const botCount = record.botDetails?.length || 0;

        if (botCount === 0) {
          return (
            <Button
              size="small"
              type="dashed"
              icon={<PlusCircleOutlined />}
              onClick={() => openAddBotModal(record)}
            >
              Add Bot
            </Button>
          );
        }

        if (botCount === 1) {
          const bot = record.botDetails![0];
          return (
            <Space align="start">
              <Space direction="vertical" size={0}>
                <Text style={{ fontSize: '12px', fontWeight: 500 }}>
                  <RobotOutlined style={{ marginRight: 4, color: 'var(--proxmox-accent)' }} />
                  {bot.id}
                </Text>
                <Text type="secondary" style={{ fontSize: '11px' }}>
                  {bot.characterName || bot.name}
                  {bot.vmName && ` (${bot.vmName})`}
                </Text>
              </Space>
              <Space>
                <Button
                  size="small"
                  type="text"
                  danger
                  onClick={() => handleRemoveBot(record, 0)}
                  style={{ padding: '0 4px', minWidth: 'auto' }}
                >
                  ×
                </Button>
                <Button
                  size="small"
                  type="dashed"
                  icon={<PlusCircleOutlined />}
                  onClick={() => openAddBotModal(record)}
                />
              </Space>
            </Space>
          );
        }

        // Больше 1 бота - показываем кнопку с количеством
        const firstBot = record.botDetails![0];
        return (
          <Space direction="vertical" size={0}>
            <Space>
              <Popover
                content={renderBotsPopover(record)}
                title={`${botCount} Linked Bots`}
                trigger="click"
                placement="right"
              >
                <Button
                  size="small"
                  type="primary"
                  icon={<RobotOutlined />}
                >
                  {botCount} bots
                </Button>
              </Popover>
              <Button
                size="small"
                type="dashed"
                icon={<PlusCircleOutlined />}
                onClick={() => openAddBotModal(record)}
              />
            </Space>
            <Text type="secondary" style={{ fontSize: '11px' }}>
              {firstBot.characterName || firstBot.name}
              {firstBot.vmName && ` (${firstBot.vmName})`}
            </Text>
          </Space>
        );
      },
    },
    {
      title: 'Expires',
      dataIndex: 'expires_at',
      key: 'expires_at',
      width: 120,
      render: (expiresAt: number) => {
        const expired = isExpired(expiresAt);
        const expiringSoon = isExpiringSoon(expiresAt);

        return (
          <Text style={{ color: expired ? '#ff4d4f' : expiringSoon ? '#faad14' : undefined }}>
            {dayjs(expiresAt).format('DD.MM.YYYY')}
          </Text>
        );
      },
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
      render: (createdAt: number) => dayjs(createdAt).format('DD.MM.YYYY'),
    },
    {
      title: 'Days Left',
      key: 'days_left',
      width: 100,
      render: (_: any, record: LicenseWithBots) => {
        const expired = isExpired(record.expires_at);
        const daysLeft = Math.ceil((record.expires_at - Date.now()) / (1000 * 60 * 60 * 24));

        if (expired) {
          return (
            <Text style={{ color: '#ff4d4f', fontSize: '14px', fontWeight: 600 }}>
              0
            </Text>
          );
        }

        // Определяем цвет в зависимости от количества дней
        let color = '#52c41a'; // Зелёный (> 7 дней)
        if (daysLeft <= 3) {
          color = '#ff4d4f'; // Красный (<= 3 дней)
        } else if (daysLeft <= 7) {
          color = '#faad14'; // Оранжевый (<= 7 дней)
        }

        return (
          <Text style={{ color, fontSize: '14px', fontWeight: 600 }}>
            {daysLeft}
          </Text>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      render: (_: any, record: LicenseWithBots) => (
        <Space size="small">
          <Tooltip title="Edit">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => openEditModal(record)}
            />
          </Tooltip>
          <Tooltip title="Copy Key">
            <Button
              type="text"
              size="small"
              icon={<CopyOutlined />}
              onClick={() => copyKey(record.key)}
            />
          </Tooltip>
          <Popconfirm
            title="Delete License?"
            description="Are you sure you want to delete this license?"
            onConfirm={() => handleDelete(record)}
            okText="Delete"
            cancelText="Cancel"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="Delete">
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Статистика
  const stats = {
    total: licenses.length,
    active: licenses.filter(l => l.status === 'active' && !isExpired(l.expires_at)).length,
    expired: licenses.filter(l => isExpired(l.expires_at)).length,
    expiringSoon: licenses.filter(l => isExpiringSoon(l.expires_at)).length,
    unassigned: licenses.filter(l => !l.bot_ids || l.bot_ids.length === 0).length,
  };



  return (
    <div className="licenses-page">
      <Card className="licenses-header">
        <div className="header-content">
          <div className="header-title">
            <Title level={4}>
              <KeyOutlined /> Bot Licenses
            </Title>
            <Text type="secondary">Manage bot software licenses</Text>
          </div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => openEditModal()}
          >
            Add License
          </Button>
        </div>
      </Card>

      <div className="licenses-stats">
        <Card className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total</div>
        </Card>
        <Card className="stat-card active">
          <div className="stat-value">{stats.active}</div>
          <div className="stat-label">Active</div>
        </Card>
        <Card className="stat-card expired">
          <div className="stat-value">{stats.expired}</div>
          <div className="stat-label">Expired</div>
        </Card>
        <Card className="stat-card warning">
          <div className="stat-value">{stats.expiringSoon}</div>
          <div className="stat-label">Expiring Soon</div>
        </Card>
        <Card className="stat-card">
          <div className="stat-value">{stats.unassigned}</div>
          <div className="stat-label">Unassigned</div>
        </Card>
      </div>

      <Card className="licenses-filters">
        <Space wrap>
          <Input
            placeholder="Search by key or bot..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 250 }}
          />
          <Select
            placeholder="Status"
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 120 }}
          >
            <Option value="all">All Statuses</Option>
            <Option value="active">Active</Option>
            <Option value="expired">Expired</Option>
            <Option value="revoked">Revoked</Option>
          </Select>
          <Select
            placeholder="Type"
            value={typeFilter}
            onChange={setTypeFilter}
            style={{ width: 120 }}
          >
            <Option value="all">All Types</Option>
            <Option value="sin">SIN</Option>
            <Option value="other">Other</Option>
          </Select>
          <Button icon={<ReloadOutlined />} onClick={() => {
            setSearchText('');
            setStatusFilter('all');
            setTypeFilter('all');
          }}>
            Reset
          </Button>
        </Space>
      </Card>

      <Card className="licenses-table-card">
        <Table
          dataSource={filteredLicenses}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} licenses`,
          }}
        />
      </Card>

      {/* Модальное окно создания/редактирования лицензии */}
      <Modal
        title={editingLicense ? 'Edit License' : 'Add License'}
        open={isModalOpen}
        onOk={form.submit}
        onCancel={() => {
          setIsModalOpen(false);
          setEditingLicense(null);
          form.resetFields();
        }}
        okText={editingLicense ? 'Update' : 'Create'}
        width={500}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
        >
          <Form.Item
            name="key"
            label="License Key"
            rules={[{ required: true, message: 'Please enter license key' }]}
          >
            <Input placeholder="Enter license key (e.g., SIN-ABC123-DEF456)" />
          </Form.Item>

          <Form.Item
            name="type"
            label="Type"
            rules={[{ required: true, message: 'Please enter license type' }]}
          >
            <AutoComplete
              placeholder="Enter type (e.g., SIN, Baneto)"
              options={Array.from(new Set(licenses.map(l => l.type).filter(Boolean))).map(type => ({
                value: type,
                label: type,
              }))}
              filterOption={(inputValue, option) =>
                option?.value?.toLowerCase().includes(inputValue.toLowerCase()) ?? false
              }
            />
          </Form.Item>

          <Form.Item
            name="expires_at"
            label="Expiration Date"
            rules={[{ required: true, message: 'Please select expiration date' }]}
            tooltip="Format: DD.MM.YYYY"
          >
            <DatePicker 
              style={{ width: '100%' }} 
              format="DD.MM.YYYY"
              placeholder="DD.MM.YYYY"
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Модальное окно добавления бота */}
      <Modal
        title="Add Bot to License"
        open={isAddBotModalOpen}
        onOk={addBotForm.submit}
        onCancel={() => {
          setIsAddBotModalOpen(false);
          setSelectedLicenseForBot(null);
          addBotForm.resetFields();
        }}
        okText="Add Bot"
        width={400}
      >
        <Form
          form={addBotForm}
          layout="vertical"
          onFinish={handleAddBot}
        >
          <Form.Item
            name="bot_id"
            label="Select Bot"
            rules={[{ required: true, message: 'Please select a bot' }]}
          >
            <Select placeholder="Select bot from list">
              {Object.entries(bots).map(([id, bot]) => {
                const characterName = bot.character?.name;
                const vmName = bot.vm?.name;
                const botName = bot.name || id.substring(0, 8);
                const displayName = characterName || botName;
                const subText = vmName ? ` (${vmName})` : '';
                return (
                  <Option key={id} value={id}>
                    {displayName}{subText} - {id.substring(0, 8)}...
                  </Option>
                );
              })}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
