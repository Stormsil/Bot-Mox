import {
  DownOutlined,
  KeyOutlined,
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
import { Button, Card, Form, Input, message, Select, Space, Table, Typography } from 'antd';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import type { BotRecord } from '../../entities/bot/model/types';
import type { BotLicense, LicenseWithBots } from '../../entities/resources/model/types';
import { uiLogger } from '../../observability/uiLogger';
import { useCurrentTime } from '../../shared/lib/hooks/useCurrentTime';
import styles from './LicensesPage.module.css';
import type { AddBotFormValues, LicenseFormValues } from './page';
import {
  AddBotModal,
  buildLicenseColumns,
  buildLicensePayload,
  computeStats,
  getCurrentTimestamp,
  LicenseEditorModal,
  LicensesStatsPanel,
  STATS_COLLAPSED_KEY,
  setLicenseEditorDefaults,
  withBotDetails,
} from './page';

const { Title, Text } = Typography;
const { Option } = Select;

const RESOURCE_POLL_MS = 7_000;
const BOT_POLL_MS = 5_000;
const LARGE_PAGE_SIZE = 5_000;

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

function buildTableFilters(values: { q: string; status: string; type: string }): CrudFilter[] {
  const next: CrudFilter[] = [];
  if (values.q.trim()) {
    next.push({ field: 'q', operator: 'eq', value: values.q.trim() });
  }
  if (values.status !== 'all') {
    next.push({ field: 'status', operator: 'eq', value: values.status });
  }
  if (values.type !== 'all') {
    next.push({ field: 'type', operator: 'eq', value: values.type });
  }
  return next;
}

export const LicensesPage: React.FC = () => {
  const licensesTable = useTable<BotLicense>({
    resource: 'licenses',
    syncWithLocation: true,
    pagination: {
      mode: 'server',
      pageSize: 10,
    },
    queryOptions: {
      refetchInterval: RESOURCE_POLL_MS,
    },
  });
  const allLicensesList = useList<BotLicense>({
    resource: 'licenses',
    pagination: {
      mode: 'server',
      currentPage: 1,
      pageSize: LARGE_PAGE_SIZE,
    },
    queryOptions: {
      refetchInterval: RESOURCE_POLL_MS,
    },
  });
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
  const createLicense = useCreate<BotLicense, HttpError, Omit<BotLicense, 'id'>>();
  const updateLicense = useUpdate<BotLicense, HttpError, Partial<BotLicense>>();
  const deleteLicense = useDelete<BotLicense>();

  const currentTime = useCurrentTime();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddBotModalOpen, setIsAddBotModalOpen] = useState(false);
  const [editingLicense, setEditingLicense] = useState<LicenseWithBots | null>(null);
  const [selectedLicenseForBot, setSelectedLicenseForBot] = useState<LicenseWithBots | null>(null);
  const [form] = Form.useForm<LicenseFormValues>();
  const [addBotForm] = Form.useForm<AddBotFormValues>();
  const [statsCollapsed, setStatsCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem(STATS_COLLAPSED_KEY);
    return saved ? Boolean(JSON.parse(saved)) : false;
  });

  const bots = useMemo(
    () =>
      (botsList.result.data || []).reduce<Record<string, BotRecord>>((acc, bot) => {
        acc[bot.id] = bot;
        return acc;
      }, {}),
    [botsList.result.data],
  );

  const tableLicenses = useMemo(
    () =>
      ((licensesTable.tableProps.dataSource as BotLicense[] | undefined) ??
        []) as LicenseWithBots[],
    [licensesTable.tableProps.dataSource],
  );
  const allLicenses = useMemo(
    () => (allLicensesList.result.data || []) as LicenseWithBots[],
    [allLicensesList.result.data],
  );

  const licensesWithBots = useMemo(
    () => withBotDetails(tableLicenses, bots),
    [tableLicenses, bots],
  );
  const allLicensesWithBots = useMemo(() => withBotDetails(allLicenses, bots), [allLicenses, bots]);
  const stats = useMemo(
    () => computeStats(allLicensesWithBots, currentTime),
    [allLicensesWithBots, currentTime],
  );

  const searchText = readFilterValue(licensesTable.filters, 'q', '');
  const statusFilter = readFilterValue(licensesTable.filters, 'status', 'all');
  const typeFilter = readFilterValue(licensesTable.filters, 'type', 'all');

  const setMergedFilters = (partial: Partial<{ q: string; status: string; type: string }>) => {
    licensesTable.setFilters(
      buildTableFilters({
        q: partial.q ?? searchText,
        status: partial.status ?? statusFilter,
        type: partial.type ?? typeFilter,
      }),
      'replace',
    );
  };

  useEffect(() => {
    localStorage.setItem(STATS_COLLAPSED_KEY, JSON.stringify(statsCollapsed));
  }, [statsCollapsed]);

  useEffect(() => {
    if (!licensesTable.tableQuery.error) return;
    uiLogger.error('Error loading licenses:', licensesTable.tableQuery.error);
    message.error('Failed to load licenses');
  }, [licensesTable.tableQuery.error]);

  useEffect(() => {
    if (!botsList.query.error) return;
    uiLogger.error('Error loading bots:', botsList.query.error);
  }, [botsList.query.error]);

  const loading =
    Boolean(licensesTable.tableProps.loading) ||
    allLicensesList.query.isLoading ||
    botsList.query.isLoading;

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    message.success('License key copied');
  };

  const handleDelete = async (license: LicenseWithBots) => {
    try {
      await deleteLicense.mutateAsync({
        resource: 'licenses',
        id: license.id,
        invalidates: ['resourceAll'],
      });
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
        await updateLicense.mutateAsync({
          resource: 'licenses',
          id: editingLicense.id,
          values: licenseData,
          invalidates: ['resourceAll'],
        });
        message.success('License updated');
      } else {
        await createLicense.mutateAsync({
          resource: 'licenses',
          values: {
            ...licenseData,
            created_at: now,
          },
          invalidates: ['resourceAll'],
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
      await updateLicense.mutateAsync({
        resource: 'licenses',
        id: selectedLicenseForBot.id,
        values: {
          bot_ids: [...currentBotIds, botId],
          updated_at: getCurrentTimestamp(),
        },
        invalidates: ['resourceAll'],
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

      await updateLicense.mutateAsync({
        resource: 'licenses',
        id: license.id,
        values: {
          bot_ids: newBotIds,
          updated_at: getCurrentTimestamp(),
        },
        invalidates: ['resourceAll'],
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
            size="small"
            value={searchText}
            onChange={(event) => setMergedFilters({ q: event.target.value })}
            className={styles.filterSearch}
            variant="filled"
          />
          <Select
            placeholder="Status"
            size="small"
            value={statusFilter}
            onChange={(value) => setMergedFilters({ status: value })}
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
            size="small"
            value={typeFilter}
            onChange={(value) => setMergedFilters({ type: value })}
            className={styles.filterSelect}
            variant="filled"
          >
            <Option value="all">All Types</Option>
            <Option value="sin">SIN</Option>
            <Option value="other">Other</Option>
          </Select>
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={() =>
              licensesTable.setFilters(
                buildTableFilters({ q: '', status: 'all', type: 'all' }),
                'replace',
              )
            }
            className={styles.resetButton}
          >
            Reset
          </Button>
        </Space>
      </Card>

      <Card className={styles.tableCard}>
        <Table
          {...licensesTable.tableProps}
          dataSource={licensesWithBots}
          columns={columns}
          rowKey="id"
          loading={loading}
          className={styles.table}
          size="small"
          pagination={
            licensesTable.tableProps.pagination
              ? {
                  ...licensesTable.tableProps.pagination,
                  pageSize: licensesTable.tableProps.pagination.pageSize ?? 10,
                  showSizeChanger: true,
                  showTotal: (total) => `Total ${total} licenses`,
                }
              : {
                  pageSize: 10,
                  showSizeChanger: true,
                  showTotal: (total) => `Total ${total} licenses`,
                }
          }
        />
      </Card>

      <LicenseEditorModal
        open={isModalOpen}
        editingLicense={editingLicense}
        licenses={allLicensesWithBots}
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
