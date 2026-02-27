import {
  DownOutlined,
  KeyOutlined,
  PlusOutlined,
  ReloadOutlined,
  RightOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useModalForm, useTable } from '@refinedev/antd';
import { type CrudFilter, type HttpError, useList, useUpdate } from '@refinedev/core';
import type { FormInstance } from 'antd';
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
const ALLOWED_STATUS_FILTERS = new Set(['all', 'active', 'expired', 'revoked']);
const ALLOWED_TYPE_FILTERS = new Set(['all', 'sin', 'other']);

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

function readEnumFilterValue(
  filters: CrudFilter[],
  field: string,
  fallback: string,
  allowedValues: Set<string>,
): string {
  const value = readFilterValue(filters, field, fallback);
  return allowedValues.has(value) ? value : fallback;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
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
  const createLicenseModal = useModalForm<BotLicense, HttpError, Omit<BotLicense, 'id'>>({
    resource: 'licenses',
    action: 'create',
    redirect: false,
    invalidates: ['resourceAll'],
  });
  const editLicenseModal = useModalForm<BotLicense, HttpError, Partial<BotLicense>>({
    resource: 'licenses',
    action: 'edit',
    redirect: false,
    invalidates: ['resourceAll'],
  });
  const updateLicense = useUpdate<BotLicense, HttpError, Partial<BotLicense>>();

  const currentTime = useCurrentTime();
  const [isAddBotModalOpen, setIsAddBotModalOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [addBotSubmitting, setAddBotSubmitting] = useState(false);
  const [selectedLicenseForBot, setSelectedLicenseForBot] = useState<LicenseWithBots | null>(null);
  const [addBotForm] = Form.useForm<AddBotFormValues>();
  const createLicenseForm = createLicenseModal.form as unknown as FormInstance<LicenseFormValues>;
  const editLicenseForm = editLicenseModal.form as unknown as FormInstance<LicenseFormValues>;
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
  const editingLicense = useMemo(() => {
    if (!editLicenseModal.id) {
      return null;
    }

    const editingId = String(editLicenseModal.id);
    return allLicensesWithBots.find((license) => String(license.id) === editingId) ?? null;
  }, [allLicensesWithBots, editLicenseModal.id]);
  const stats = useMemo(
    () => computeStats(allLicensesWithBots, currentTime),
    [allLicensesWithBots, currentTime],
  );

  const searchText = readFilterValue(licensesTable.filters, 'q', '');
  const statusFilter = readEnumFilterValue(
    licensesTable.filters,
    'status',
    'all',
    ALLOWED_STATUS_FILTERS,
  );
  const typeFilter = readEnumFilterValue(
    licensesTable.filters,
    'type',
    'all',
    ALLOWED_TYPE_FILTERS,
  );

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

  const handleCreate = async (values: LicenseFormValues) => {
    if (createSubmitting) {
      return;
    }

    setCreateSubmitting(true);
    try {
      const now = getCurrentTimestamp();
      const licenseData = buildLicensePayload(values, now, []);
      await createLicenseModal.onFinish({
        ...licenseData,
        created_at: now,
      });
      message.success('License created');
      createLicenseModal.close();
      createLicenseForm.resetFields();
      setLicenseEditorDefaults(createLicenseForm);
    } catch (error) {
      uiLogger.error('Error creating license:', error);
      message.error(`Failed to save license: ${getErrorMessage(error, 'Unknown error')}`);
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleEdit = async (values: LicenseFormValues) => {
    if (editSubmitting) {
      return;
    }

    setEditSubmitting(true);
    try {
      if (!editLicenseModal.id) {
        return;
      }

      const now = getCurrentTimestamp();
      const licenseData = buildLicensePayload(values, now, editingLicense?.bot_ids || []);
      await editLicenseModal.onFinish(licenseData);
      message.success('License updated');
      editLicenseModal.close();
      editLicenseForm.resetFields();
    } catch (error) {
      uiLogger.error('Error updating license:', error);
      message.error(`Failed to save license: ${getErrorMessage(error, 'Unknown error')}`);
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleAddBot = async (values: AddBotFormValues) => {
    if (!selectedLicenseForBot) {
      return;
    }
    if (addBotSubmitting) {
      return;
    }

    setAddBotSubmitting(true);
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
      message.error(`Failed to add bot: ${getErrorMessage(error, 'Unknown error')}`);
    } finally {
      setAddBotSubmitting(false);
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

  const openCreateModal = () => {
    setLicenseEditorDefaults(createLicenseForm);
    createLicenseModal.show();
  };

  const openEditModal = (license: LicenseWithBots) => {
    setLicenseEditorDefaults(editLicenseForm, license);
    editLicenseModal.show(license.id);
  };

  const columns = buildLicenseColumns({
    currentTime,
    handlers: {
      onEdit: openEditModal,
      onCopyKey: copyKey,
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
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
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
            licensesTable.tableProps.pagination &&
            typeof licensesTable.tableProps.pagination === 'object'
              ? {
                  ...licensesTable.tableProps.pagination,
                  current: Math.max(1, Number(licensesTable.tableProps.pagination.current) || 1),
                  pageSize: Math.max(1, Number(licensesTable.tableProps.pagination.pageSize) || 10),
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
        open={createLicenseModal.open}
        editingLicense={null}
        licenses={allLicensesWithBots}
        form={createLicenseForm}
        submitting={createSubmitting || createLicenseModal.formLoading}
        onCancel={() => {
          createLicenseModal.close();
          createLicenseForm.resetFields();
          setLicenseEditorDefaults(createLicenseForm);
        }}
        onSave={handleCreate}
      />

      <LicenseEditorModal
        open={editLicenseModal.open}
        editingLicense={editingLicense}
        licenses={allLicensesWithBots}
        form={editLicenseForm}
        submitting={editSubmitting || editLicenseModal.formLoading}
        onCancel={() => {
          editLicenseModal.close();
          editLicenseForm.resetFields();
        }}
        onSave={handleEdit}
      />

      <AddBotModal
        open={isAddBotModalOpen}
        bots={bots}
        form={addBotForm}
        submitting={addBotSubmitting || updateLicense.mutation.isPending}
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
