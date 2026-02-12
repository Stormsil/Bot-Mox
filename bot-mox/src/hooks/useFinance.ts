import { useState, useEffect, useCallback, useMemo } from 'react';
import { message } from 'antd';
import type {
  FinanceOperation,
  FinanceOperationFormData,
  FinanceSummary,
  CategoryBreakdown,
  TimeSeriesData,
  FinanceOperationType,
  FinanceCategory,
} from '../types';
import {
  subscribeToFinanceOperations,
  createFinanceOperation,
  updateFinanceOperation,
  deleteFinanceOperation,
  calculateFinanceSummary,
  calculateCategoryBreakdown,
  prepareTimeSeriesData,
  filterOperations,
} from '../services/financeService';

interface UseFinanceOptions {
  days?: number;
}

interface UseFinanceReturn {
  // Данные
  operations: FinanceOperation[];
  summary: FinanceSummary;
  incomeBreakdown: CategoryBreakdown[];
  expenseBreakdown: CategoryBreakdown[];
  timeSeriesData: TimeSeriesData[];
  loading: boolean;
  error: Error | null;

  // Методы
  addOperation: (data: FinanceOperationFormData) => Promise<void>;
  updateOperation: (id: string, data: Partial<FinanceOperationFormData>) => Promise<void>;
  deleteOperation: (id: string) => Promise<void>;

  // Фильтрация
  filteredOperations: (
    type: FinanceOperationType | 'all',
    category: FinanceCategory | 'all',
    project_id: 'wow_tbc' | 'wow_midnight' | 'all',
    dateFrom: string | null,
    dateTo: string | null
  ) => FinanceOperation[];
}

/**
 * Хук для работы с финансовыми операциями
 * Автоматически загружает операции и вычисляет статистику
 */
export function useFinance(options: UseFinanceOptions = {}): UseFinanceReturn {
  const { days = 30 } = options;

  // Состояния
  const [operations, setOperations] = useState<FinanceOperation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  // Загрузка операций
  useEffect(() => {
    const unsubscribe = subscribeToFinanceOperations(
      (data) => {
        setOperations(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error loading finance operations:', err);
        setError(err);
        setLoading(false);
        message.error('Failed to load finance data');
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  // Вычисляем сводку
  const summary = useMemo(() => {
    return calculateFinanceSummary(operations);
  }, [operations]);

  // Вычисляем распределение по категориям
  const incomeBreakdown = useMemo(() => {
    return calculateCategoryBreakdown(operations, 'income');
  }, [operations]);

  const expenseBreakdown = useMemo(() => {
    return calculateCategoryBreakdown(operations, 'expense');
  }, [operations]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  // Подготавливаем данные для графика
  const timeSeriesData = useMemo(() => {
    const end = currentTime;
    const start = end - days * 24 * 60 * 60 * 1000;
    return prepareTimeSeriesData(operations, start, end);
  }, [operations, days, currentTime]);

  // Добавление операции
  const addOperation = useCallback(async (data: FinanceOperationFormData): Promise<void> => {
    try {
      await createFinanceOperation(data);
      message.success('Transaction added successfully');
    } catch (err) {
      console.error('Error adding operation:', err);
      message.error('Failed to add transaction');
      throw err;
    }
  }, []);

  // Обновление операции
  const updateOperation = useCallback(async (
    id: string,
    data: Partial<FinanceOperationFormData>
  ): Promise<void> => {
    try {
      await updateFinanceOperation(id, data);
      message.success('Transaction updated successfully');
    } catch (err) {
      console.error('Error updating operation:', err);
      message.error('Failed to update transaction');
      throw err;
    }
  }, []);

  // Удаление операции
  const deleteOperation = useCallback(async (id: string): Promise<void> => {
    try {
      await deleteFinanceOperation(id);
      message.success('Transaction deleted successfully');
    } catch (err) {
      console.error('Error deleting operation:', err);
      message.error('Failed to delete transaction');
      throw err;
    }
  }, []);

  // Note: Gold price is now entered manually per transaction
  // Price history is derived from past sale operations

  // Фильтрация операций
  const filteredOperations = useCallback(
    (
      type: FinanceOperationType | 'all',
      category: FinanceCategory | 'all',
      project_id: 'wow_tbc' | 'wow_midnight' | 'all',
      dateFrom: string | null,
      dateTo: string | null
    ): FinanceOperation[] => {
      return filterOperations(operations, {
        type,
        category,
        project_id,
        dateFrom,
        dateTo,
      });
    },
    [operations]
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
