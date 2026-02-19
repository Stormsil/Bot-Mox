import {
  DownOutlined,
  KeyOutlined,
  PlusOutlined,
  ReloadOutlined,
  RightOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { Button, Card, Form, Input, message, Select, Space, Table, Typography } from 'antd';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useBotsMapQuery } from '../../entities/bot/api/useBotQueries';
import {
  useCreateLicenseMutation,
  useDeleteLicenseMutation,
  useUpdateLicenseMutation,
} from '../../entities/resources/api/useLicenseMutations';
import { useLicensesQuery } from '../../entities/resources/api/useResourcesQueries';
import { uiLogger } from '../../observability/uiLogger';
import type { LicenseWithBots } from '../../types';
import styles from './LicensesPage.module.css';
import type { AddBotFormValues, LicenseFormValues } from './page';
import {
  AddBotModal,
  buildLicenseColumns,
  buildLicensePayload,
  computeStats,
  filterLicenses,
  getCurrentTimestamp,
  LicenseEditorModal,
  LicensesStatsPanel,
  STATS_COLLAPSED_KEY,
  setLicenseEditorDefaults,
  withBotDetails,
} from './page';

const { Title, Text } = Typography;
const { Option } = Select;

export const LicensesPage: React.FC = () => {
  const licensesQuery = useLicensesQuery();
  const createLicenseMutation = useCreateLicenseMutation();
  const updateLicenseMutation = useUpdateLicenseMutation();
  const deleteLicenseMutation = useDeleteLicenseMutation();
  const botsMapQuery = useBotsMapQuery();
  const licenses = useMemo(
    () => (licensesQuery.data || []) as LicenseWithBots[],
    [licensesQuery.data],
  );
  const bots = useMemo(() => botsMapQuery.data || {}, [botsMapQuery.data]);
  const loading = licensesQuery.isLoading || botsMapQuery.isLoading;
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
    if (!licensesQuery.error) return;
    uiLogger.error('Error loading licenses:', licensesQuery.error);
    message.error('Failed to load licenses');
  }, [licensesQuery.error]);

  useEffect(() => {
    if (!botsMapQuery.error) return;
    uiLogger.error('Error loading bots:', botsMapQuery.error);
  }, [botsMapQuery.error]);

  const licensesWithBots = useMemo(() => withBotDetails(licenses, bots), [licenses, bots]);
  const filteredLicenses = useMemo(
    () => filterLicenses(licensesWithBots, searchText, statusFilter, typeFilter),
    [licensesWithBots, searchText, statusFilter, typeFilter],
  );
  const stats = useMemo(
    () => computeStats(licensesWithBots, currentTime),
    [licensesWithBots, currentTime],
  );

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    message.success('License key copied');
  };

  const handleDelete = async (license: LicenseWithBots) => {
    try {
      await deleteLicenseMutation.mutateAsync(license.id);
      message.success('License deleted');
    } catch (error) {
      uiLogger.error('Error deleting license:', error);
      message.error('Failed to delete license');
    }
  };

  const handleSave = async (values: LicenseFormValues) => {
    try {
      const now = getCurrentTimestamp();
      const licenseData = buildLicensePayload(values, now, editingLicense?.bot_ids || []);

      if (editingLicense) {
        await updateLicenseMutation.mutateAsync({ id: editingLicense.id, payload: licenseData });
        message.success('License updated');
      } else {
        await createLicenseMutation.mutateAsync({
          ...licenseData,
          created_at: now,
        });
        message.success('License created');
      }

      setIsModalOpen(false);
      setEditingLicense(null);
      form.resetFields();
    } catch (error) {
      uiLogger.error('Error saving license:', error);
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
      await updateLicenseMutation.mutateAsync({
        id: selectedLicenseForBot.id,
        payload: {
          bot_ids: [...currentBotIds, botId],
          updated_at: getCurrentTimestamp(),
        },
      });

      message.success('Bot added to license');
      setIsAddBotModalOpen(false);
      setSelectedLicenseForBot(null);
      addBotForm.resetFields();
    } catch (error) {
      uiLogger.error('Error adding bot:', error);
      message.error('Failed to add bot');
    }
  };

  const handleRemoveBot = async (license: LicenseWithBots, botIndex: number) => {
    try {
      const newBotIds = [...(license.bot_ids || [])];
      newBotIds.splice(botIndex, 1);

      await updateLicenseMutation.mutateAsync({
        id: license.id,
        payload: {
          bot_ids: newBotIds,
          updated_at: getCurrentTimestamp(),
        },
      });

      message.success('Bot removed from license');
    } catch (error) {
      uiLogger.error('Error removing bot:', error);
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
    <div className={styles.root}>
      <Card className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerTitle}>
            <Title level={4} className={styles.headerHeading}>
              <KeyOutlined /> Bot Licenses
            </Title>
            <Text type="secondary" className={styles.headerSubtitle}>
              Manage bot software licenses
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
              Add License
            </Button>
          </Space>
        </div>
      </Card>

      <LicensesStatsPanel stats={stats} collapsed={statsCollapsed} />

      <Card className={styles.filters}>
        <Space wrap className={styles.filtersSpace}>
          <Input
            placeholder="Search by key or bot..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            className={styles.filterSearch}
            variant="filled"
          />
          <Select
            placeholder="Status"
            value={statusFilter}
            onChange={setStatusFilter}
            className={styles.filterSelect}
            variant="filled"
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
            className={styles.filterSelect}
            variant="filled"
          >
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
            className={styles.resetButton}
          >
            Reset
          </Button>
        </Space>
      </Card>

      <Card className={styles.tableCard}>
        <Table
          dataSource={filteredLicenses}
          columns={columns.map((column) => ({
            ...column,
            onHeaderCell: () => ({ className: styles.tableHeaderCell }),
            onCell: () => ({ className: styles.tableCell }),
          }))}
          rowKey="id"
          rowClassName={() => styles.tableRow}
          loading={loading}
          className={styles.table}
          rowClassName={() => styles.tableRow}
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
