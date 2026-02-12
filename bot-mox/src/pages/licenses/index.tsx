import React, { useEffect, useMemo, useState } from 'react';
import { DownOutlined, KeyOutlined, PlusOutlined, ReloadOutlined, RightOutlined, SearchOutlined } from '@ant-design/icons';
import { Button, Card, Form, Input, Select, Space, Table, Typography, message } from 'antd';
import { subscribeBotsMap } from '../../services/botsApiService';
import type { BotRecord } from '../../services/botsApiService';
import { createLicense, deleteLicense, subscribeLicenses, updateLicense } from '../../services/licensesApiService';
import type { LicenseWithBots } from '../../types';
import {
  AddBotModal,
  LicenseEditorModal,
  LicensesStatsPanel,
  STATS_COLLAPSED_KEY,
  buildLicenseColumns,
  buildLicensePayload,
  computeStats,
  filterLicenses,
  getCurrentTimestamp,
  setLicenseEditorDefaults,
  withBotDetails,
} from './page';
import type { AddBotFormValues, LicenseFormValues } from './page';
import './LicensesPage.css';

const { Title, Text } = Typography;
const { Option } = Select;

export const LicensesPage: React.FC = () => {
  const [licenses, setLicenses] = useState<LicenseWithBots[]>([]);
  const [bots, setBots] = useState<Record<string, BotRecord>>({});
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddBotModalOpen, setIsAddBotModalOpen] = useState(false);
  const [editingLicense, setEditingLicense] = useState<LicenseWithBots | null>(null);
  const [selectedLicenseForBot, setSelectedLicenseForBot] = useState<LicenseWithBots | null>(null);
  const [currentTime, setCurrentTime] = useState(() => getCurrentTimestamp());
  const [form] = Form.useForm<LicenseFormValues>();
  const [addBotForm] = Form.useForm<AddBotFormValues>();
  const [statsCollapsed, setStatsCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem(STATS_COLLAPSED_KEY);
    return saved ? Boolean(JSON.parse(saved)) : false;
  });

  useEffect(() => {
    localStorage.setItem(STATS_COLLAPSED_KEY, JSON.stringify(statsCollapsed));
  }, [statsCollapsed]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTime(getCurrentTimestamp());
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const unsubscribeLicenses = subscribeLicenses(
      (licensesList) => {
        setLicenses(licensesList as LicenseWithBots[]);
        setLoading(false);
      },
      (error) => {
        console.error('Error loading licenses:', error);
        message.error('Failed to load licenses');
        setLoading(false);
      }
    );

    const unsubscribeBots = subscribeBotsMap(
      (data) => {
        setBots(data || {});
      },
      (error) => {
        console.error('Error loading bots:', error);
      },
      { intervalMs: 5000 }
    );

    return () => {
      unsubscribeLicenses();
      unsubscribeBots();
    };
  }, []);

  const licensesWithBots = useMemo(() => withBotDetails(licenses, bots), [licenses, bots]);
  const filteredLicenses = useMemo(
    () => filterLicenses(licensesWithBots, searchText, statusFilter, typeFilter),
    [licensesWithBots, searchText, statusFilter, typeFilter]
  );
  const stats = useMemo(() => computeStats(licensesWithBots, currentTime), [licensesWithBots, currentTime]);

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    message.success('License key copied');
  };

  const handleDelete = async (license: LicenseWithBots) => {
    try {
      await deleteLicense(license.id);
      message.success('License deleted');
    } catch (error) {
      console.error('Error deleting license:', error);
      message.error('Failed to delete license');
    }
  };

  const handleSave = async (values: LicenseFormValues) => {
    try {
      const now = getCurrentTimestamp();
      const licenseData = buildLicensePayload(values, now, editingLicense?.bot_ids || []);

      if (editingLicense) {
        await updateLicense(editingLicense.id, licenseData);
        message.success('License updated');
      } else {
        await createLicense({
          ...licenseData,
          created_at: now,
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

  const handleAddBot = async (values: AddBotFormValues) => {
    if (!selectedLicenseForBot) {
      return;
    }

    try {
      const botId = values.bot_id;
      const currentBotIds = selectedLicenseForBot.bot_ids || [];
      await updateLicense(selectedLicenseForBot.id, {
        bot_ids: [...currentBotIds, botId],
        updated_at: getCurrentTimestamp(),
      });

      message.success('Bot added to license');
      setIsAddBotModalOpen(false);
      setSelectedLicenseForBot(null);
      addBotForm.resetFields();
    } catch (error) {
      console.error('Error adding bot:', error);
      message.error('Failed to add bot');
    }
  };

  const handleRemoveBot = async (license: LicenseWithBots, botIndex: number) => {
    try {
      const newBotIds = [...(license.bot_ids || [])];
      newBotIds.splice(botIndex, 1);

      await updateLicense(license.id, {
        bot_ids: newBotIds,
        updated_at: getCurrentTimestamp(),
      });

      message.success('Bot removed from license');
    } catch (error) {
      console.error('Error removing bot:', error);
      message.error('Failed to remove bot');
    }
  };

  const openAddBotModal = (license: LicenseWithBots) => {
    setSelectedLicenseForBot(license);
    addBotForm.resetFields();
    setIsAddBotModalOpen(true);
  };

  const openEditModal = (license?: LicenseWithBots) => {
    if (license) {
      setEditingLicense(license);
      setLicenseEditorDefaults(form, license);
    } else {
      setEditingLicense(null);
      setLicenseEditorDefaults(form);
    }
    setIsModalOpen(true);
  };

  const columns = buildLicenseColumns({
    currentTime,
    handlers: {
      onEdit: openEditModal,
      onCopyKey: copyKey,
      onDelete: handleDelete,
      onAddBot: openAddBotModal,
      onRemoveBot: handleRemoveBot,
    },
  });

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
          <Space>
            <Button
              type="text"
              icon={statsCollapsed ? <RightOutlined /> : <DownOutlined />}
              onClick={() => setStatsCollapsed((prev) => !prev)}
            >
              Stats
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditModal()}>
              Add License
            </Button>
          </Space>
        </div>
      </Card>

      <LicensesStatsPanel stats={stats} collapsed={statsCollapsed} />

      <Card className="licenses-filters">
        <Space wrap>
          <Input
            placeholder="Search by key or bot..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            style={{ width: 250 }}
          />
          <Select placeholder="Status" value={statusFilter} onChange={setStatusFilter} style={{ width: 120 }}>
            <Option value="all">All Statuses</Option>
            <Option value="active">Active</Option>
            <Option value="expired">Expired</Option>
            <Option value="revoked">Revoked</Option>
          </Select>
          <Select placeholder="Type" value={typeFilter} onChange={setTypeFilter} style={{ width: 120 }}>
            <Option value="all">All Types</Option>
            <Option value="sin">SIN</Option>
            <Option value="other">Other</Option>
          </Select>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              setSearchText('');
              setStatusFilter('all');
              setTypeFilter('all');
            }}
          >
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

      <LicenseEditorModal
        open={isModalOpen}
        editingLicense={editingLicense}
        licenses={licenses}
        form={form}
        onCancel={() => {
          setIsModalOpen(false);
          setEditingLicense(null);
          form.resetFields();
        }}
        onSave={handleSave}
      />

      <AddBotModal
        open={isAddBotModalOpen}
        bots={bots}
        form={addBotForm}
        onCancel={() => {
          setIsAddBotModalOpen(false);
          setSelectedLicenseForBot(null);
          addBotForm.resetFields();
        }}
        onSave={handleAddBot}
      />
    </div>
  );
};
