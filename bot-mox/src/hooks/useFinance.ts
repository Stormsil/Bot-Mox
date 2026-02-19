import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  calculateCategoryBreakdown,
  calculateFinanceSummary,
  filterOperations,
  prepareTimeSeriesData,
} from '../entities/finance/lib/analytics';
import type {
  CategoryBreakdown,
  FinanceCategory,
  FinanceOperation,
  FinanceOperationFormData,
  FinanceOperationType,
  FinanceSummary,
  TimeSeriesData,
} from '../entities/finance/model/types';
import { useFinanceOperations } from '../features/finance/model/useFinanceOperations';

interface UseFinanceOptions {
  days?: number;
}

interface UseFinanceReturn {
  operations: FinanceOperation[];
  summary: FinanceSummary;
  incomeBreakdown: CategoryBreakdown[];
  expenseBreakdown: CategoryBreakdown[];
  timeSeriesData: TimeSeriesData[];
  loading: boolean;
  error: Error | null;
  addOperation: (data: FinanceOperationFormData) => Promise<void>;
  updateOperation: (id: string, data: Partial<FinanceOperationFormData>) => Promise<void>;
  deleteOperation: (id: string) => Promise<void>;
  filteredOperations: (
    type: FinanceOperationType | 'all',
    category: FinanceCategory | 'all',
    project_id: 'wow_tbc' | 'wow_midnight' | 'all',
    dateFrom: string | null,
    dateTo: string | null,
  ) => FinanceOperation[];
}

/**
 * @deprecated Use FSD hooks from `features/finance/model` directly.
 * Kept as compatibility adapter during phased migration.
 */
export function useFinance(options: UseFinanceOptions = {}): UseFinanceReturn {
  const { days = 30 } = options;
  const { operations, loading, error, addOperation, updateOperation, deleteOperation } =
    useFinanceOperations();
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  const summary = useMemo(() => calculateFinanceSummary(operations), [operations]);
  const incomeBreakdown = useMemo(
    () => calculateCategoryBreakdown(operations, 'income'),
    [operations],
  );
  const expenseBreakdown = useMemo(
    () => calculateCategoryBreakdown(operations, 'expense'),
    [operations],
  );

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 60_000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const timeSeriesData = useMemo(() => {
    const end = currentTime;
    const start = end - days * 24 * 60 * 60 * 1000;
    return prepareTimeSeriesData(operations, start, end);
  }, [currentTime, days, operations]);

  const filteredOperations = useCallback(
    (
      type: FinanceOperationType | 'all',
      category: FinanceCategory | 'all',
      project_id: 'wow_tbc' | 'wow_midnight' | 'all',
      dateFrom: string | null,
      dateTo: string | null,
    ): FinanceOperation[] =>
      filterOperations(operations, {
        type,
        category,
        project_id,
        dateFrom,
        dateTo,
      }),
    [operations],
  );

  return {
    operations,
    summary,
    incomeBreakdown,
    expenseBreakdown,
    timeSeriesData,
    loading,
    error,
    addOperation,
    updateOperation,
    deleteOperation,
    filteredOperations,
  };
}
