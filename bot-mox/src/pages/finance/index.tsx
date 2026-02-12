import React, { useState, useMemo } from 'react';
import { Select, Space, DatePicker, Card, Typography } from 'antd';
import { ContentPanel } from '../../components/layout/ContentPanel';
import { FinanceSummary, FinanceTransactions, TransactionForm } from '../../components/finance';
import { useFinance } from '../../hooks/useFinance';
import { 
  getGoldPriceHistoryFromOperations,
  calculateFinanceSummary,
  calculateCategoryBreakdown,
  prepareTimeSeriesData,
} from '../../services/financeService';
import type { FinanceOperation, FinanceOperationFormData } from '../../types';
import dayjs from 'dayjs';
import './FinancePage.css';

const { RangePicker } = DatePicker;
const { Text, Title } = Typography;

type FinanceTab = 'summary' | 'transactions' | 'gold_price';
type ProjectFilter = 'all' | 'wow_tbc' | 'wow_midnight';

export const FinancePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<FinanceTab>('summary');
  const [selectedProject, setSelectedProject] = useState<ProjectFilter>('all');
  // State for date range (default to last 30 days)
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>([
    dayjs().subtract(30, 'days'),
    dayjs()
  ]);

  const [formVisible, setFormVisible] = useState(false);
  const [editingOperation, setEditingOperation] = useState<FinanceOperation | null>(null);

  const {
    operations,
    loading,
    addOperation,
    updateOperation,
    deleteOperation,
  } = useFinance({ days: 365 }); // Fetch enough data initially

  // Filter operations based on project and date range
  const filteredOperations = useMemo(() => {
    let filtered = operations;

    // Filter by project
    if (selectedProject !== 'all') {
      filtered = filtered.filter(op => op.project_id === selectedProject || op.project_id === null);
      // Note: We include null project_id (global ops) if we want them to show everywhere, 
      // OR we exclude them. Usually global costs (like server hosting) should be visible or split.
      // For now, let's strict filter: if selecting a project, show only that project's direct costs/income?
      // Or maybe global ops should be shown in 'all' only?
      // Let's filter strictly by project_id for now, assuming global ops have project_id=null
      // If user selects 'wow_tbc', they shouldn't see 'wow_midnight' ops.
      // Global ops (null) might be relevant to all, but hard to split. 
      // Let's include nulls only in 'all'.
      filtered = operations.filter(op => op.project_id === selectedProject);
    }

    // Filter by date range
    if (dateRange) {
      const [start, end] = dateRange;
      const startTime = start.startOf('day').valueOf();
      const endTime = end.endOf('day').valueOf();
      filtered = filtered.filter(op => op.date >= startTime && op.date <= endTime);
    }

    return filtered;
  }, [operations, selectedProject, dateRange]);

  // Recalculate derived data based on filtered operations
  const summary = useMemo(() => calculateFinanceSummary(filteredOperations), [filteredOperations]);
  const incomeBreakdown = useMemo(() => calculateCategoryBreakdown(filteredOperations, 'income'), [filteredOperations]);
  const expenseBreakdown = useMemo(() => calculateCategoryBreakdown(filteredOperations, 'expense'), [filteredOperations]);
  
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
      dateRange[1].endOf('day').valueOf()
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
    await deleteOperation(id);
  };

  const handleFormSubmit = async (data: FinanceOperationFormData) => {
    if (editingOperation) {
      await updateOperation(editingOperation.id, data);
    } else {
      await addOperation(data);
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
        onChange={(dates) => setDateRange(dates ? [dates[0]!, dates[1]!] : null)}
        allowClear={false}
      />
    </Space>
  );

  return (
    <div className="finance-page">
      {/* Global Filter Bar */}
      <Card bordered={false} className="finance-filter-bar" bodyStyle={{ padding: '14px 16px' }}>
        <div className="finance-toolbar">
          <div className="finance-toolbar-left">
            <Title level={4} className="finance-title">Finance</Title>
            <Text type="secondary" className="finance-subtitle">
              Operational cashflow and performance
            </Text>
          </div>
          <div className="finance-toolbar-right">
            {headerExtra}
          </div>
        </div>
      </Card>

      <ContentPanel
        type="finance"
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as FinanceTab)}
        className="finance-content-panel"
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
