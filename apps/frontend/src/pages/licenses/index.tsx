import { DownOutlined, PlusOutlined, RightOutlined } from '@ant-design/icons';
import { List, useModalForm, useTable } from '@refinedev/antd';
import { type CrudFilter, type HttpError, useList, useUpdate } from '@refinedev/core';
import type { FormInstance } from 'antd';
import { message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import type { BotRecord } from '../../entities/bot/model/types';
import type { BotLicense, LicenseWithBots } from '../../entities/resources/model/types';
import { uiLogger } from '../../observability/uiLogger';
import { useCurrentTime } from '../../shared/lib/hooks/useCurrentTime';
import {
  AppTable,
  AppButton as Button,
  AppCard as Card,
  AppForm as Form,
  AppSpace as Space,
} from '../../shared/ui';
import styles from './LicensesPage.module.css';
import type { AddBotFormValues, LicenseFormValues } from './page';
import {
  AddBotModal,
  buildLicenseColumns,
  buildLicensePayload,
  computeStats,
  getCurrentTimestamp,
  LicenseEditorModal,
  LicensesFiltersCard,
  LicensesStatsPanel,
  STATS_COLLAPSED_KEY,
  setLicenseEditorDefaults,
  withBotDetails,
} from './page';

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
  const syncWithLocationEnabled = !(typeof navigator !== 'undefined' && navigator.webdriver);

  const licensesTable = useTable<BotLicense>({
    resource: 'licenses',
    syncWithLocation: syncWithLocationEnabled,
    pagination: {
      mode: 'server',
      pageSize: 10,
    },
    queryOptions: syncWithLocationEnabled
      ? undefined
      : {
          refetchOnMount: false,
          refetchOnWindowFocus: false,
          refetchOnReconnect: false,
          staleTime: 60_000,
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
    syncWithLocation: false,
    invalidates: ['resourceAll'],
    successNotification: () => ({
      message: 'License created',
      type: 'success',
    }),
    errorNotification: (error) => ({
      message: `Failed to save license: ${getErrorMessage(error, 'Unknown error')}`,
      type: 'error',
    }),
  });
  const editLicenseModal = useModalForm<BotLicense, HttpError, Partial<BotLicense>>({
    resource: 'licenses',
    action: 'edit',
    redirect: false,
    syncWithLocation: false,
    invalidates: ['resourceAll'],
    successNotification: () => ({
      message: 'License updated',
      type: 'success',
    }),
    errorNotification: (error) => ({
      message: `Failed to save license: ${getErrorMessage(error, 'Unknown error')}`,
      type: 'error',
    }),
  });
  const updateLicense = useUpdate<BotLicense, HttpError, Partial<BotLicense>>();

  const currentTime = useCurrentTime();
  const [isAddBotModalOpen, setIsAddBotModalOpen] = useState(false);
  const [selectedLicenseForBot, setSelectedLicenseForBot] = useState<LicenseWithBots | null>(null);
  const [selectedLicenseForEdit, setSelectedLicenseForEdit] = useState<LicenseWithBots | null>(
    null,
  );
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
  const licensesWithBots = useMemo(
    () => withBotDetails(tableLicenses, bots),
    [tableLicenses, bots],
  );
  const editingLicense = useMemo(() => {
    if (!editLicenseModal.id) {
      return null;
    }

    const editingId = String(editLicenseModal.id);
    if (selectedLicenseForEdit && String(selectedLicenseForEdit.id) === editingId) {
      return selectedLicenseForEdit;
    }

    return licensesWithBots.find((license) => String(license.id) === editingId) ?? null;
  }, [licensesWithBots, editLicenseModal.id, selectedLicenseForEdit]);
  const createLicenseFormProps = useMemo(
    () => ({
      ...createLicenseModal.formProps,
      onFinish: async (values: LicenseFormValues) => {
        const now = getCurrentTimestamp();
        const licenseData = buildLicensePayload(values, now, []);

        return createLicenseModal.onFinish({
          ...licenseData,
          created_at: now,
        });
      },
    }),
    [createLicenseModal.formProps, createLicenseModal.onFinish],
  );
  const editLicenseFormProps = useMemo(
    () => ({
      ...editLicenseModal.formProps,
      onFinish: async (values: LicenseFormValues) => {
        const now = getCurrentTimestamp();
        return editLicenseModal.onFinish(
          buildLicensePayload(values, now, editingLicense?.bot_ids || []),
        );
      },
    }),
    [editLicenseModal.formProps, editLicenseModal.onFinish, editingLicense?.bot_ids],
  );
  const stats = useMemo(
    () => computeStats(licensesWithBots, currentTime),
    [licensesWithBots, currentTime],
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

  const loading = Boolean(licensesTable.tableProps.loading) || botsList.query.isLoading;

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    message.success('License key copied');
  };

  const handleAddBot = (values: AddBotFormValues): Promise<void> => {
    if (!selectedLicenseForBot) {
      return Promise.resolve();
    }

    const botId = values.bot_id;
    const currentBotIds = selectedLicenseForBot.bot_ids || [];

    return new Promise<void>((resolve, reject) => {
      updateLicense.mutate(
        {
          resource: 'licenses',
          id: selectedLicenseForBot.id,
          values: {
            bot_ids: [...currentBotIds, botId],
            updated_at: getCurrentTimestamp(),
          },
          invalidates: ['resourceAll'],
        },
        {
          onSuccess: () => {
            setIsAddBotModalOpen(false);
            setSelectedLicenseForBot(null);
            addBotForm.resetFields();
            resolve();
          },
          onError: (error) => {
            uiLogger.error('Error adding bot:', error);
            reject(error);
          },
        },
      );
    });
  };

  const handleRemoveBot = (license: LicenseWithBots, botIndex: number): Promise<void> => {
    const newBotIds = [...(license.bot_ids || [])];
    newBotIds.splice(botIndex, 1);

    return new Promise<void>((resolve, reject) => {
      updateLicense.mutate(
        {
          resource: 'licenses',
          id: license.id,
          values: {
            bot_ids: newBotIds,
            updated_at: getCurrentTimestamp(),
          },
          invalidates: ['resourceAll'],
        },
        {
          onSuccess: () => {
            resolve();
          },
          onError: (error) => {
            uiLogger.error('Error removing bot:', error);
            reject(error);
          },
        },
      );
    });
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
    setSelectedLicenseForEdit(license);
    setLicenseEditorDefaults(editLicenseForm, license);
    editLicenseModal.show(license.id);
  };

  useEffect(() => {
    if (editLicenseModal.modalProps.open) {
      return;
    }

    setSelectedLicenseForEdit(null);
  }, [editLicenseModal.modalProps.open]);

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
    <List
      createButtonProps={{
        children: 'Add License',
        icon: <PlusOutlined />,
        onClick: (event) => {
          event.preventDefault();
          openCreateModal();
        },
      }}
      headerButtons={({ defaultButtons }) => (
        <Space>
          <Button
            type="text"
            icon={statsCollapsed ? <RightOutlined /> : <DownOutlined />}
            onClick={() => setStatsCollapsed((prev) => !prev)}
          >
            Stats
          </Button>
          {defaultButtons}
        </Space>
      )}
    >
      <div className={styles.root}>
        <LicensesStatsPanel stats={stats} collapsed={statsCollapsed} />

        <LicensesFiltersCard
          searchText={searchText}
          statusFilter={statusFilter}
          typeFilter={typeFilter}
          onSearchChange={(value) => setMergedFilters({ q: value })}
          onStatusChange={(value) => setMergedFilters({ status: value })}
          onTypeChange={(value) => setMergedFilters({ type: value })}
          onReset={() =>
            licensesTable.setFilters(
              buildTableFilters({ q: '', status: 'all', type: 'all' }),
              'replace',
            )
          }
        />

        <Card className={styles.tableCard}>
          <AppTable
            {...licensesTable.tableProps}
            dataSource={licensesWithBots}
            columns={columns}
            rowKey="id"
            loading={loading}
            className={styles.table}
          />
        </Card>

        <LicenseEditorModal
          modalProps={{
            ...createLicenseModal.modalProps,
            title: 'Add License',
            okText: 'Create',
            onCancel: () => {
              createLicenseModal.close();
              createLicenseForm.resetFields();
              setLicenseEditorDefaults(createLicenseForm);
            },
          }}
          formProps={createLicenseFormProps}
        />

        <LicenseEditorModal
          modalProps={{
            ...editLicenseModal.modalProps,
            title: 'Edit License',
            okText: 'Update',
            onCancel: () => {
              editLicenseModal.close();
              editLicenseForm.resetFields();
              setSelectedLicenseForEdit(null);
            },
          }}
          formProps={editLicenseFormProps}
        />

        <AddBotModal
          open={isAddBotModalOpen}
          bots={bots}
          form={addBotForm}
          submitting={updateLicense.mutation.isPending}
          onCancel={() => {
            setIsAddBotModalOpen(false);
            setSelectedLicenseForBot(null);
            addBotForm.resetFields();
          }}
          onSave={handleAddBot}
        />
      </div>
    </List>
  );
};
