import { useCreate, useDelete, useInfiniteList, useUpdate } from '@refinedev/core';
import { useQuery } from '@tanstack/react-query';

import dayjs from 'dayjs';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { mapFinanceOperationsFromInfinitePages } from '../../entities/finance/lib/financeOperationMapper';
import {
  buildFinanceOperationCreatePayload,
  buildFinanceOperationPatchPayload,
} from '../../entities/finance/lib/financeOperationPayload';
import type {
  FinanceOperation,
  FinanceOperationFormData,
} from '../../entities/finance/model/types';
import { uiLogger } from '../../observability/uiLogger';
import {
  type FinanceOperationContractRecord,
  getFinanceBreakdownViaContract,
  getFinanceSummaryViaContract,
  getFinanceTimeSeriesViaContract,
} from '../../shared/api/providers/finance-contract-client';
import {
  AppCard as Card,
  AppDatePicker as DatePicker,
  AppSelect as Select,
  AppSpace as Space,
  AppTypography as Typography,
} from '../../shared/ui';
import {
  FinanceSummary as FinanceSummaryWidget,
  FinanceTransactions,
  TransactionForm,
} from '../../widgets/finance';
import { ContentPanel } from '../../widgets/layout/ContentPanel';
import styles from './FinancePage.module.css';
import {
  getGoldPriceHistoryFromOperationsLocal,
  mapBreakdownFromAggregate,
  mapSummaryFromAggregate,
  mapTimeSeriesFromAggregate,
} from './mappers';

const { RangePicker } = DatePicker;
const { Text, Title } = Typography;

type FinanceTab = 'summary' | 'transactions' | 'gold_price';
type ProjectFilter = 'all' | 'wow_tbc' | 'wow_midnight';

const FINANCE_PAGE_SIZE = 200;
const FINANCE_REFETCH_INTERVAL_MS = 4_000;

export const FinancePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<FinanceTab>('summary');
  const [selectedProject, setSelectedProject] = useState<ProjectFilter>('all');
  // State for date range (default to last 30 days)
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>([
    dayjs().subtract(30, 'days'),
    dayjs(),
  ]);

  const [formVisible, setFormVisible] = useState(false);
  const [editingOperation, setEditingOperation] = useState<FinanceOperation | null>(null);
  const [isFinanceInitialLoadComplete, setIsFinanceInitialLoadComplete] = useState(false);

  const financeOperationsList = useInfiniteList<FinanceOperationContractRecord>({
    resource: 'finance/operations',
    pagination: {
      mode: 'server',
      currentPage: 1,
      pageSize: FINANCE_PAGE_SIZE,
    },
    sorters: [{ field: 'date', order: 'desc' }],
    queryOptions: {
      refetchInterval: FINANCE_REFETCH_INTERVAL_MS,
    },
  });
  const createFinanceOperation = useCreate();
  const updateFinanceOperation = useUpdate();
  const deleteFinanceOperation = useDelete();

  const { query: financeOperationsQuery, result: financeOperationsResult } = financeOperationsList;

  useEffect(() => {
    if (!financeOperationsResult.hasNextPage) {
      return;
    }
    if (financeOperationsQuery.isLoading || financeOperationsQuery.isFetchingNextPage) {
      return;
    }

    void financeOperationsQuery.fetchNextPage();
  }, [
    financeOperationsQuery.fetchNextPage,
    financeOperationsQuery.isFetchingNextPage,
    financeOperationsQuery.isLoading,
    financeOperationsResult.hasNextPage,
  ]);

  useEffect(() => {
    if (isFinanceInitialLoadComplete) {
      return;
    }
    if (!financeOperationsResult.data) {
      return;
    }
    if (financeOperationsResult.hasNextPage) {
      return;
    }
    if (financeOperationsQuery.isLoading || financeOperationsQuery.isFetchingNextPage) {
      return;
    }

    setIsFinanceInitialLoadComplete(true);
  }, [
    financeOperationsQuery.isFetchingNextPage,
    financeOperationsQuery.isLoading,
    financeOperationsResult.data,
    financeOperationsResult.hasNextPage,
    isFinanceInitialLoadComplete,
  ]);

  const operations = useMemo(
    () => mapFinanceOperationsFromInfinitePages(financeOperationsResult.data?.pages),
    [financeOperationsResult.data?.pages],
  );

  const aggregateQuery = useMemo(() => {
    const fromTs = dateRange ? dateRange[0].startOf('day').valueOf() : undefined;
    const toTs = dateRange ? dateRange[1].endOf('day').valueOf() : undefined;
    return {
      ...(fromTs !== undefined ? { from_ts: fromTs } : {}),
      ...(toTs !== undefined ? { to_ts: toTs } : {}),
      ...(selectedProject !== 'all' ? { project_id: selectedProject } : {}),
    };
  }, [dateRange, selectedProject]);

  const financeSummaryAggregateQuery = useQuery({
    queryKey: ['finance', 'summary-aggregate', aggregateQuery],
    refetchInterval: FINANCE_REFETCH_INTERVAL_MS,
    queryFn: async () => {
      const payload = await getFinanceSummaryViaContract(aggregateQuery);
      return payload.data;
    },
  });
  const financeBreakdownAggregateQuery = useQuery({
    queryKey: ['finance', 'breakdown-aggregate', aggregateQuery],
    refetchInterval: FINANCE_REFETCH_INTERVAL_MS,
    queryFn: async () => {
      const payload = await getFinanceBreakdownViaContract(aggregateQuery);
      return payload.data;
    },
  });
  const financeTimeSeriesAggregateQuery = useQuery({
    queryKey: ['finance', 'time-series-aggregate', aggregateQuery],
    refetchInterval: FINANCE_REFETCH_INTERVAL_MS,
    queryFn: async () => {
      const payload = await getFinanceTimeSeriesViaContract({
        ...aggregateQuery,
        granularity: 'day',
      });
      return payload.data;
    },
  });

  useEffect(() => {
    if (!financeSummaryAggregateQuery.error) {
      return;
    }
    uiLogger.error('Error loading finance summary aggregates:', financeSummaryAggregateQuery.error);
  }, [financeSummaryAggregateQuery.error]);
  useEffect(() => {
    if (!financeBreakdownAggregateQuery.error) {
      return;
    }
    uiLogger.error(
      'Error loading finance breakdown aggregates:',
      financeBreakdownAggregateQuery.error,
    );
  }, [financeBreakdownAggregateQuery.error]);
  useEffect(() => {
    if (!financeTimeSeriesAggregateQuery.error) {
      return;
    }
    uiLogger.error(
      'Error loading finance time-series aggregates:',
      financeTimeSeriesAggregateQuery.error,
    );
  }, [financeTimeSeriesAggregateQuery.error]);

  const financeListLoading =
    !isFinanceInitialLoadComplete &&
    (financeOperationsQuery.isLoading ||
      financeOperationsQuery.isFetchingNextPage ||
      Boolean(financeOperationsResult.hasNextPage));
  const financeAggregateLoading =
    financeSummaryAggregateQuery.isFetching ||
    financeBreakdownAggregateQuery.isFetching ||
    financeTimeSeriesAggregateQuery.isFetching;
  const loading =
    financeListLoading ||
    financeAggregateLoading ||
    createFinanceOperation.mutation.isPending ||
    updateFinanceOperation.mutation.isPending ||
    deleteFinanceOperation.mutation.isPending;

  // Filter operations based on project and date range
  const filteredOperations = useMemo(() => {
    let filtered = operations;

    if (selectedProject !== 'all') {
      filtered = operations.filter((op) => op.project_id === selectedProject);
    }

    if (dateRange) {
      const [start, end] = dateRange;
      const startTime = start.startOf('day').valueOf();
      const endTime = end.endOf('day').valueOf();
      filtered = filtered.filter((op) => op.date >= startTime && op.date <= endTime);
    }

    return filtered;
  }, [operations, selectedProject, dateRange]);

  const summary = useMemo(() => {
    return mapSummaryFromAggregate(financeSummaryAggregateQuery.data);
  }, [financeSummaryAggregateQuery.data]);
  const incomeBreakdown = useMemo(() => {
    return mapBreakdownFromAggregate(financeBreakdownAggregateQuery.data, 'income');
  }, [financeBreakdownAggregateQuery.data]);
  const expenseBreakdown = useMemo(() => {
    return mapBreakdownFromAggregate(financeBreakdownAggregateQuery.data, 'expense');
  }, [financeBreakdownAggregateQuery.data]);

  // Calculate days difference for time series
  const daysDiff = useMemo(() => {
    if (!dateRange) return 30;
    return dateRange[1].diff(dateRange[0], 'day') + 1;
  }, [dateRange]);

  const timeSeriesData = useMemo(() => {
    if (!dateRange) return [];
    return mapTimeSeriesFromAggregate(financeTimeSeriesAggregateQuery.data);
  }, [dateRange, financeTimeSeriesAggregateQuery.data]);

  // Get gold price history (from ALL operations to show trends, or filtered? Filtered makes sense)
  const goldPriceHistory = useMemo(() => {
    return getGoldPriceHistoryFromOperationsLocal(filteredOperations);
  }, [filteredOperations]);

  // Handle adding transaction
  const handleAdd = () => {
    setEditingOperation(null);
    setFormVisible(true);
  };

  const handleEdit = (operation: FinanceOperation) => {
    setEditingOperation(operation);
    setFormVisible(true);
  };

  const handleDelete = (id: string) => {
    deleteFinanceOperation.mutate(
      {
        resource: 'finance/operations',
        id,
        invalidates: ['resourceAll'],
      },
      {
        onError: (error) => {
          uiLogger.error('Error deleting operation:', error);
        },
      },
    );
  };

  const handleFormSubmit = (data: FinanceOperationFormData): Promise<void> => {
    if (editingOperation) {
      return new Promise<void>((resolve, reject) => {
        updateFinanceOperation.mutate(
          {
            resource: 'finance/operations',
            id: editingOperation.id,
            values: buildFinanceOperationPatchPayload(data),
            invalidates: ['resourceAll'],
          },
          {
            onSuccess: () => {
              setFormVisible(false);
              setEditingOperation(null);
              resolve();
            },
            onError: (error) => {
              uiLogger.error('Error updating operation:', error);
              reject(error);
            },
          },
        );
      });
    }

    return new Promise<void>((resolve, reject) => {
      createFinanceOperation.mutate(
        {
          resource: 'finance/operations',
          values: buildFinanceOperationCreatePayload(data),
          invalidates: ['resourceAll'],
        },
        {
          onSuccess: () => {
            setFormVisible(false);
            setEditingOperation(null);
            resolve();
          },
          onError: (error) => {
            uiLogger.error('Error adding operation:', error);
            reject(error);
          },
        },
      );
    });
  };

  const handleFormCancel = () => {
    setFormVisible(false);
    setEditingOperation(null);
  };

  // Render content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'summary':
        return (
          <FinanceSummaryWidget
            summary={summary}
            incomeBreakdown={incomeBreakdown}
            expenseBreakdown={expenseBreakdown}
            timeSeriesData={timeSeriesData}
            goldPriceHistory={goldPriceHistory}
            loading={loading}
            timeRange={daysDiff}
            onTimeRangeChange={(days: number) => {
              // Update the Date Range picker based on quick select
              setDateRange([dayjs().subtract(days, 'days'), dayjs()]);
            }}
            selectedProject={selectedProject}
            operations={filteredOperations}
          />
        );
      case 'transactions':
        return (
          <FinanceTransactions
            operations={filteredOperations}
            loading={loading}
            onAdd={handleAdd}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        );
      default:
        return null;
    }
  };

  // Header Extra Content (Filters)
  const headerExtra = (
    <Space>
      <Select
        value={selectedProject}
        onChange={setSelectedProject}
        style={{ width: 160 }}
        options={[
          { value: 'all', label: 'All Projects' },
          { value: 'wow_tbc', label: 'WoW TBC Classic' },
          { value: 'wow_midnight', label: 'WoW Midnight' },
        ]}
      />
      <RangePicker
        value={dateRange}
        onChange={(dates) => {
          const [start, end] = dates ?? [];
          if (!start || !end) {
            setDateRange(null);
            return;
          }
          setDateRange([start, end]);
        }}
        allowClear={false}
      />
    </Space>
  );

  return (
    <div className={styles.root}>
      {/* Global Filter Bar */}
      <Card variant="borderless" className={styles.filterBar}>
        <div className={styles.toolbar}>
          <div className={styles.toolbarLeft}>
            <Title level={4} className={styles.title}>
              Finance
            </Title>
            <Text type="secondary" className={styles.subtitle}>
              Operational cashflow and performance
            </Text>
          </div>
          <div className={styles.toolbarRight}>{headerExtra}</div>
        </div>
      </Card>

      <ContentPanel
        type="finance"
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as FinanceTab)}
        className={styles.contentPanel}
      >
        {renderTabContent()}
      </ContentPanel>

      <TransactionForm
        visible={formVisible}
        operation={editingOperation}
        onCancel={handleFormCancel}
        onSubmit={handleFormSubmit}
        loading={loading}
      />
    </div>
  );
};
