import { useCreate, useDelete, useInfiniteList, useUpdate } from '@refinedev/core';
import { Card, DatePicker, message, Select, Space, Typography } from 'antd';
import dayjs from 'dayjs';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  calculateCategoryBreakdown,
  calculateFinanceSummary,
  getGoldPriceHistoryFromOperations,
  prepareTimeSeriesData,
} from '../../entities/finance/lib/analytics';
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
import type { FinanceOperationContractRecord } from '../../shared/api/providers/finance-contract-client';
import { FinanceSummary, FinanceTransactions, TransactionForm } from '../../widgets/finance';
import { ContentPanel } from '../../widgets/layout/ContentPanel';
import styles from './FinancePage.module.css';

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

  const financeListLoading =
    !isFinanceInitialLoadComplete &&
    (financeOperationsQuery.isLoading ||
      financeOperationsQuery.isFetchingNextPage ||
      Boolean(financeOperationsResult.hasNextPage));
  const loading =
    financeListLoading ||
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

  // Recalculate derived data based on filtered operations
  const summary = useMemo(() => calculateFinanceSummary(filteredOperations), [filteredOperations]);
  const incomeBreakdown = useMemo(
    () => calculateCategoryBreakdown(filteredOperations, 'income'),
    [filteredOperations],
  );
  const expenseBreakdown = useMemo(
    () => calculateCategoryBreakdown(filteredOperations, 'expense'),
    [filteredOperations],
  );

  // Calculate days difference for time series
  const daysDiff = useMemo(() => {
    if (!dateRange) return 30;
    return dateRange[1].diff(dateRange[0], 'day') + 1;
  }, [dateRange]);

  const timeSeriesData = useMemo(() => {
    if (!dateRange) return [];
    return prepareTimeSeriesData(
      filteredOperations,
      dateRange[0].startOf('day').valueOf(),
      dateRange[1].endOf('day').valueOf(),
    );
  }, [filteredOperations, dateRange]);

  // Get gold price history (from ALL operations to show trends, or filtered? Filtered makes sense)
  const goldPriceHistory = useMemo(() => {
    return getGoldPriceHistoryFromOperations(filteredOperations);
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

  const handleDelete = async (id: string) => {
    try {
      await deleteFinanceOperation.mutateAsync({
        resource: 'finance/operations',
        id,
        invalidates: ['resourceAll'],
      });
      message.success('Transaction deleted successfully');
    } catch (error) {
      uiLogger.error('Error deleting operation:', error);
      message.error('Failed to delete transaction');
      throw error;
    }
  };

  const handleFormSubmit = async (data: FinanceOperationFormData) => {
    try {
      if (editingOperation) {
        await updateFinanceOperation.mutateAsync({
          resource: 'finance/operations',
          id: editingOperation.id,
          values: buildFinanceOperationPatchPayload(data),
          invalidates: ['resourceAll'],
        });
        message.success('Transaction updated successfully');
      } else {
        await createFinanceOperation.mutateAsync({
          resource: 'finance/operations',
          values: buildFinanceOperationCreatePayload(data),
          invalidates: ['resourceAll'],
        });
        message.success('Transaction added successfully');
      }
    } catch (error) {
      if (editingOperation) {
        uiLogger.error('Error updating operation:', error);
        message.error('Failed to update transaction');
      } else {
        uiLogger.error('Error adding operation:', error);
        message.error('Failed to add transaction');
      }
      throw error;
    }
    setFormVisible(false);
    setEditingOperation(null);
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
          <FinanceSummary
            summary={summary}
            incomeBreakdown={incomeBreakdown}
            expenseBreakdown={expenseBreakdown}
            timeSeriesData={timeSeriesData}
            goldPriceHistory={goldPriceHistory}
            loading={loading}
            timeRange={daysDiff}
            onTimeRangeChange={(days) => {
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
