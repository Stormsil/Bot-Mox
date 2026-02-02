import React, { useState, useEffect } from 'react';
import { Card, Typography, Tag, Button, Space, Alert, Spin, Empty, message, Modal, Form, Input, DatePicker, AutoComplete, Popconfirm } from 'antd';
import { KeyOutlined, CopyOutlined, WarningOutlined, CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined, EditOutlined, DeleteOutlined, PlusOutlined, LinkOutlined } from '@ant-design/icons';
import { ref, onValue, update, remove, push, set } from 'firebase/database';
import { database } from '../../utils/firebase';
import type { BotLicense as BotLicenseType } from '../../types';
import type { Bot } from '../../types';
import dayjs from 'dayjs';
import './BotLicense.css';

const { Title, Text } = Typography;

interface BotLicenseProps {
  bot: Bot;
}

interface LicenseInfo extends BotLicenseType {
  daysRemaining?: number;
  isExpired?: boolean;
  isExpiringSoon?: boolean;
}

export const BotLicense: React.FC<BotLicenseProps> = ({ bot }) => {
  const [license, setLicense] = useState<LicenseInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [allLicenses, setAllLicenses] = useState<LicenseInfo[]>([]);
  const [form] = Form.useForm();
  const [createForm] = Form.useForm();
  const [assignForm] = Form.useForm();

  // Загрузка данных из Firebase
  useEffect(() => {
    const licensesRef = ref(database, 'bot_licenses');
    
    const unsubscribe = onValue(licensesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const licensesList = Object.entries(data).map(([id, value]) => {
          const lic = value as BotLicenseType;
          const daysRemaining = Math.ceil((lic.expires_at - Date.now()) / (1000 * 60 * 60 * 24));
          return {
            ...lic,
            id,
            daysRemaining,
            isExpired: Date.now() > lic.expires_at,
            isExpiringSoon: daysRemaining <= 3 && daysRemaining > 0,
          };
        }) as LicenseInfo[];
        
        setAllLicenses(licensesList);
        
        // Находим лицензию, привязанную к этому боту
        const foundLicense = licensesList.find((lic) => lic.bot_ids?.includes(bot.id));
        setLicense(foundLicense || null);
      } else {
        setLicense(null);
        setAllLicenses([]);
      }
      setLoading(false);
    }, (error) => {
      console.error('Error loading license:', error);
      message.error('Failed to load license data');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [bot.id]);

  const copyKey = () => {
    if (license?.key) {
      navigator.clipboard.writeText(license.key);
      message.success('License key copied');
    }
  };

  // Открытие модалки редактирования
  const openEditModal = () => {
    if (license) {
      form.setFieldsValue({
        key: license.key,
        type: license.type,
        expires_at: dayjs(license.expires_at),
      });
      setIsModalOpen(true);
    }
  };

  // Открытие модалки создания
  const openCreateModal = () => {
    createForm.resetFields();
    createForm.setFieldsValue({
      expires_at: dayjs().add(30, 'days'),
    });
    setIsCreateModalOpen(true);
  };

  // Открытие модалки привязки существующей лицензии
  const openAssignModal = () => {
    assignForm.resetFields();
    setIsAssignModalOpen(true);
  };

  // Сохранение лицензии (редактирование)
  const handleSave = async (values: any) => {
    try {
      const expiresAt = values.expires_at.valueOf();
      const isExpired = Date.now() > expiresAt;
      const status = isExpired ? 'expired' : 'active';

      if (license) {
        const licenseData = {
          key: values.key,
          type: values.type,
          status: status,
          expires_at: expiresAt,
          updated_at: Date.now(),
        };
        await update(ref(database, `bot_licenses/${license.id}`), licenseData);
        message.success('License updated');
        setIsModalOpen(false);
      }
      form.resetFields();
    } catch (error) {
      console.error('Error saving license:', error);
      message.error('Failed to save license');
    }
  };

  // Создание новой лицензии и привязка к боту
  const handleCreate = async (values: any) => {
    try {
      const expiresAt = values.expires_at.valueOf();
      const isExpired = Date.now() > expiresAt;
      const status = isExpired ? 'expired' : 'active';

      const licenseData = {
        key: values.key,
        type: values.type,
        status: status,
        bot_ids: [bot.id],
        expires_at: expiresAt,
        created_at: Date.now(),
        updated_at: Date.now(),
      };

      const newRef = push(ref(database, 'bot_licenses'));
      await set(newRef, licenseData);
      message.success('License created and assigned to bot');
      setIsCreateModalOpen(false);
      createForm.resetFields();
    } catch (error) {
      console.error('Error creating license:', error);
      message.error('Failed to create license');
    }
  };

  // Привязка существующей лицензии к боту
  const handleAssign = async (values: any) => {
    try {
      const licenseId = values.license_id;
      const selectedLicense = allLicenses.find(l => l.id === licenseId);
      if (!selectedLicense) return;

      const currentBotIds = selectedLicense.bot_ids || [];
      if (currentBotIds.includes(bot.id)) {
        message.warning('Bot is already assigned to this license');
        return;
      }

      await update(ref(database, `bot_licenses/${licenseId}`), {
        bot_ids: [...currentBotIds, bot.id],
        updated_at: Date.now(),
      });
      message.success('Bot assigned to license');
      setIsAssignModalOpen(false);
      assignForm.resetFields();
    } catch (error) {
      console.error('Error assigning license:', error);
      message.error('Failed to assign license');
    }
  };

  // Удаление лицензии
  const handleDelete = async () => {
    if (!license) return;
    try {
      await remove(ref(database, `bot_licenses/${license.id}`));
      message.success('License deleted');
    } catch (error) {
      console.error('Error deleting license:', error);
      message.error('Failed to delete license');
    }
  };

  // Отвязка бота от лицензии
  const handleUnassign = async () => {
    if (!license) return;
    try {
      const newBotIds = (license.bot_ids || []).filter(id => id !== bot.id);
      
      if (newBotIds.length === 0) {
        await remove(ref(database, `bot_licenses/${license.id}`));
        message.success('License deleted (no bots assigned)');
      } else {
        await update(ref(database, `bot_licenses/${license.id}`), {
          bot_ids: newBotIds,
          updated_at: Date.now(),
        });
        message.success('Bot unassigned from license');
      }
    } catch (error) {
      console.error('Error unassigning bot:', error);
      message.error('Failed to unassign bot');
    }
  };

  // Получение доступных лицензий для привязки
  const getAvailableLicenses = () => {
    return allLicenses.filter(l => !l.bot_ids?.includes(bot.id));
  };

  const getStatusIcon = () => {
    if (license?.isExpired) return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />;
    if (license?.isExpiringSoon) return <ClockCircleOutlined style={{ color: '#faad14' }} />;
    return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
  };

  const getStatusColor = () => {
    if (license?.isExpired) return 'error';
    if (license?.isExpiringSoon) return 'warning';
    return 'success';
  };

  const getStatusText = () => {
    if (license?.isExpired) return 'Expired';
    if (license?.isExpiringSoon) return `Expiring in ${license.daysRemaining} days`;
    return 'Active';
  };

  const getDaysLeftColor = () => {
    if (license?.isExpired) return '#ff4d4f';
    if (license?.isExpiringSoon) return '#faad14';
    return '#52c41a';
  };

  if (loading) {
    return (
      <div className="bot-license">
        <Card className="license-card">
          <Spin size="large" />
        </Card>
      </div>
    );
  }

  // Если нет лицензии - показываем Empty с кнопками создания/привязки
  if (!license) {
    return (
      <div className="bot-license">
        <Card className="license-card">
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span>
                <Text type="secondary">No license assigned to this bot</Text>
              </span>
            }
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={openCreateModal}
                block
              >
                Create New License
              </Button>
              {getAvailableLicenses().length > 0 && (
                <Button
                  icon={<LinkOutlined />}
                  onClick={openAssignModal}
                  block
                >
                  Assign Existing License
                </Button>
              )}
            </Space>
          </Empty>
        </Card>

        {/* Модальное окно создания лицензии */}
        <Modal
          title="Create New License"
          open={isCreateModalOpen}
          onOk={createForm.submit}
          onCancel={() => {
            setIsCreateModalOpen(false);
            createForm.resetFields();
          }}
          okText="Create"
          width={500}
        >
          <Form
            form={createForm}
            layout="vertical"
            onFinish={handleCreate}
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
                options={Array.from(new Set(allLicenses.map(l => l.type).filter(Boolean))).map(type => ({
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
            >
              <DatePicker 
                style={{ width: '100%' }} 
                placeholder="DD.MM.YYYY"
                format="DD.MM.YYYY"
              />
            </Form.Item>
          </Form>
        </Modal>

        {/* Модальное окно привязки существующей лицензии */}
        <Modal
          title="Assign Existing License"
          open={isAssignModalOpen}
          onOk={assignForm.submit}
          onCancel={() => {
            setIsAssignModalOpen(false);
            assignForm.resetFields();
          }}
          okText="Assign"
          width={500}
        >
          <Form
            form={assignForm}
            layout="vertical"
            onFinish={handleAssign}
          >
            <Form.Item
              name="license_id"
              label="Select License"
              rules={[{ required: true, message: 'Please select a license' }]}
            >
              <AutoComplete
                placeholder="Search and select license"
                options={getAvailableLicenses().map(lic => ({
                  value: lic.id,
                  label: `${lic.key.substring(0, 30)}... (${lic.type}) - Expires: ${dayjs(lic.expires_at).format('DD.MM.YYYY')}`,
                }))}
                filterOption={(inputValue, option) =>
                  option?.label?.toLowerCase().includes(inputValue.toLowerCase()) ?? false
                }
                onSelect={(value) => assignForm.setFieldsValue({ license_id: value })}
              />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    );
  }

  return (
    <div className="bot-license">
      {/* Alert для истекающей/истекшей лицензии */}
      {(license.isExpired || license.isExpiringSoon) && (
        <Alert
          className="license-alert"
          message={license.isExpired ? 'License Expired' : 'License Expiring Soon'}
          description={
            license.isExpired 
              ? 'This license has expired. The bot may stop functioning. Please renew the license.'
              : `This license will expire in ${license.daysRemaining} day(s). Please renew soon to avoid interruption.`
          }
          type={license.isExpired ? 'error' : 'warning'}
          showIcon
          icon={<WarningOutlined />}
        />
      )}

      <Card 
        className="license-card" 
        title={
          <Space>
            <KeyOutlined />
            <span>License Information</span>
          </Space>
        }
        extra={
          <Space>
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={openEditModal}
            >
              Edit
            </Button>
            <Popconfirm
              title="Unassign License?"
              description="This will remove the bot from this license. The license will be deleted if no bots remain."
              onConfirm={handleUnassign}
              okText="Unassign"
              cancelText="Cancel"
            >
              <Button
                type="text"
                size="small"
                danger
              >
                Unassign
              </Button>
            </Popconfirm>
          </Space>
        }
      >
        <div className="license-content">
          <div className="license-field">
            <Text type="secondary" className="field-label">License Key</Text>
            <div className="license-key-container">
              <Text className="license-key" copyable={{ text: license.key, icon: <CopyOutlined /> }}>
                {license.key.substring(0, 40)}...
              </Text>
              <Button 
                type="text" 
                size="small" 
                icon={<CopyOutlined />}
                onClick={copyKey}
              >
                Copy
              </Button>
            </div>
          </div>

          <div className="license-row">
            <div className="license-field">
              <Text type="secondary" className="field-label">Bot Name</Text>
              <div>
                <Text strong>{bot.character?.name || bot.name || bot.id.substring(0, 8)}</Text>
              </div>
            </div>

            <div className="license-field">
              <Text type="secondary" className="field-label">Status</Text>
              <div>
                <Tag color={getStatusColor()} icon={getStatusIcon()}>
                  {getStatusText()}
                </Tag>
              </div>
            </div>
          </div>

          <div className="license-row">
            <div className="license-field">
              <Text type="secondary" className="field-label">Created</Text>
              <div>
                <Text>{dayjs(license.created_at).format('DD.MM.YYYY')}</Text>
              </div>
            </div>

            <div className="license-field">
              <Text type="secondary" className="field-label">Last Updated</Text>
              <div>
                <Text>{dayjs(license.updated_at).format('DD.MM.YYYY')}</Text>
              </div>
            </div>
          </div>

          <div className="license-row">
            <div className="license-field">
              <Text type="secondary" className="field-label">Expiration Date</Text>
              <div>
                <Text>{dayjs(license.expires_at).format('DD.MM.YYYY')}</Text>
              </div>
            </div>

            <div className="license-field">
              <Text type="secondary" className="field-label">Days Left</Text>
              <div>
                <Text strong style={{ color: getDaysLeftColor() }}>
                  {license.isExpired ? '0' : license.daysRemaining}
                </Text>
              </div>
            </div>
          </div>

          {license.isExpired && (
            <div className="license-actions">
              <Alert
                message="Action Required"
                description="Please renew this license to continue bot operation."
                type="error"
                showIcon
              />
            </div>
          )}
        </div>
      </Card>

      {/* Модальное окно редактирования лицензии */}
      <Modal
        title="Edit License"
        open={isModalOpen}
        onOk={form.submit}
        onCancel={() => {
          setIsModalOpen(false);
          form.resetFields();
        }}
        okText="Update"
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
              options={Array.from(new Set(allLicenses.map(l => l.type).filter(Boolean))).map(type => ({
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
          >
              <DatePicker 
                style={{ width: '100%' }} 
                placeholder="DD.MM.YYYY"
                format="DD.MM.YYYY"
              />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
