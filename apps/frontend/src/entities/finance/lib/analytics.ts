import dayjs from 'dayjs';
import type {
  CategoryBreakdown,
  FinanceCategory,
  FinanceOperation,
  FinanceOperationType,
  FinanceSummary,
  GoldPriceHistoryEntry,
  TimeSeriesData,
} from '../model/types';
import { formatTimestampToDay, parseDateToTimestamp } from './analyticsDate';

export function calculateFinanceSummary(operations: FinanceOperation[]): FinanceSummary {
  const totalIncome = operations
    .filter((operation) => operation.type === 'income')
    .reduce((accumulator, operation) => accumulator + operation.amount, 0);

  const totalExpenses = operations
    .filter((operation) => operation.type === 'expense')
    .reduce((accumulator, operation) => accumulator + operation.amount, 0);

  const totalGoldSold = operations
    .filter((operation) => operation.type === 'income' && operation.category === 'sale')
    .reduce((accumulator, operation) => accumulator + (operation.gold_amount || 0), 0);

  const goldSaleOperations = operations.filter(
    (operation) =>
      operation.type === 'income' &&
      operation.category === 'sale' &&
      typeof operation.gold_price_at_time === 'number' &&
      operation.gold_price_at_time > 0,
  );

  const averageGoldPrice =
    goldSaleOperations.length > 0
      ? goldSaleOperations.reduce(
          (accumulator, operation) => accumulator + (operation.gold_price_at_time || 0),
          0,
        ) / goldSaleOperations.length
      : 0;

  return {
    totalIncome,
    totalExpenses,
    netProfit: totalIncome - totalExpenses,
    totalGoldSold,
    totalGoldFarmed: 0,
    averageGoldPrice,
  };
}

export function calculateCategoryBreakdown(
  operations: FinanceOperation[],
  type: FinanceOperationType,
): CategoryBreakdown[] {
  const filteredOperations = operations.filter((operation) => operation.type === type);
  const total = filteredOperations.reduce(
    (accumulator, operation) => accumulator + operation.amount,
    0,
  );
  const categoryMap = new Map<string, number>();

  filteredOperations.forEach((operation) => {
    const current = categoryMap.get(operation.category) || 0;
    categoryMap.set(operation.category, current + operation.amount);
  });

  return [...categoryMap.entries()]
    .map(([category, amount]) => ({
      category: category as FinanceCategory,
      amount,
      percentage: total > 0 ? Math.round((amount / total) * 100) : 0,
    }))
    .sort((left, right) => right.amount - left.amount);
}

export function prepareTimeSeriesData(
  operations: FinanceOperation[],
  startDate: number,
  endDate: number,
): TimeSeriesData[] {
  const grouped = new Map<string, { income: number; expense: number }>();

  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const current = new Date(start);
  while (current <= end) {
    const dateStr = formatTimestampToDay(current.getTime());
    grouped.set(dateStr, { income: 0, expense: 0 });
    current.setDate(current.getDate() + 1);
  }

  operations.forEach((operation) => {
    if (operation.date < start.getTime() || operation.date > end.getTime()) {
      return;
    }
    const dateStr = formatTimestampToDay(operation.date);
    const currentData = grouped.get(dateStr);
    if (!currentData) {
      return;
    }
    if (operation.type === 'income') {
      currentData.income += operation.amount;
    } else {
      currentData.expense += operation.amount;
    }
    grouped.set(dateStr, currentData);
  });

  const sortedData = [...grouped.entries()]
    .map(([date, data]) => ({
      date,
      income: data.income,
      expense: data.expense,
      dailyProfit: data.income - data.expense,
    }))
    .sort((left, right) => dayjs(left.date).valueOf() - dayjs(right.date).valueOf());

  let runningTotal = 0;
  return sortedData.map((item) => {
    runningTotal += item.dailyProfit;
    return {
      ...item,
      profit: runningTotal,
      cumulativeProfit: runningTotal,
    };
  });
}

export function getGoldPriceHistoryFromOperations(
  operations: FinanceOperation[],
): GoldPriceHistoryEntry[] {
  const saleOperations = operations.filter(
    (operation) =>
      operation.type === 'income' &&
      operation.category === 'sale' &&
      typeof operation.gold_price_at_time === 'number' &&
      operation.gold_price_at_time > 0 &&
      operation.project_id,
  );

  const grouped = new Map<string, GoldPriceHistoryEntry>();

  saleOperations.forEach((operation) => {
    const dateStr = formatTimestampToDay(operation.date);
    const key = `${dateStr}_${operation.project_id}`;
    const existing = grouped.get(key);

    if (existing) {
      existing.price = (existing.price + (operation.gold_price_at_time || 0)) / 2;
      grouped.set(key, existing);
      return;
    }

    grouped.set(key, {
      date: dateStr,
      price: operation.gold_price_at_time || 0,
      project_id: operation.project_id as 'wow_tbc' | 'wow_midnight',
    });
  });

  return [...grouped.values()].sort(
    (left, right) => dayjs(left.date).valueOf() - dayjs(right.date).valueOf(),
  );
}

export function filterOperations(
  operations: FinanceOperation[],
  filters: {
    type?: FinanceOperationType | 'all';
    category?: FinanceCategory | 'all';
    project_id?: string | 'all';
    dateFrom?: string | null;
    dateTo?: string | null;
  },
): FinanceOperation[] {
  return operations.filter((operation) => {
    if (filters.type && filters.type !== 'all' && operation.type !== filters.type) {
      return false;
    }
    if (filters.category && filters.category !== 'all' && operation.category !== filters.category) {
      return false;
    }
    if (
      filters.project_id &&
      filters.project_id !== 'all' &&
      operation.project_id !== filters.project_id
    ) {
      return false;
    }
    if (filters.dateFrom) {
      const fromTimestamp = parseDateToTimestamp(filters.dateFrom);
      if (operation.date < fromTimestamp) {
        return false;
      }
    }
    if (filters.dateTo) {
      const toTimestamp = parseDateToTimestamp(filters.dateTo);
      if (operation.date > toTimestamp) {
        return false;
      }
    }
    return true;
  });
}

export { formatTimestampToDay, parseDateToTimestamp } from './analyticsDate';
export { normalizeFinanceOperationRecord } from './financeOperationMapper';
