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
    .filter((op) => op.type === 'income')
    .reduce((acc, op) => acc + op.amount, 0);

  const totalExpenses = operations
    .filter((op) => op.type === 'expense')
    .reduce((acc, op) => acc + op.amount, 0);

  const totalGoldSold = operations
    .filter((op) => op.type === 'income' && op.category === 'sale')
    .reduce((acc, op) => acc + (op.gold_amount || 0), 0);

  const goldSaleOperations = operations.filter(
    (op) => op.type === 'income' && op.category === 'sale' && op.gold_price_at_time,
  );

  const averageGoldPrice =
    goldSaleOperations.length > 0
      ? goldSaleOperations.reduce((acc, op) => acc + (op.gold_price_at_time || 0), 0) /
        goldSaleOperations.length
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
  const filteredOps = operations.filter((op) => op.type === type);
  const total = filteredOps.reduce((acc, op) => acc + op.amount, 0);
  const categoryMap = new Map<string, number>();

  filteredOps.forEach((op) => {
    const current = categoryMap.get(op.category) || 0;
    categoryMap.set(op.category, current + op.amount);
  });

  return Array.from(categoryMap.entries())
    .map(([category, amount]) => ({
      category: category as FinanceCategory,
      amount,
      percentage: total > 0 ? Math.round((amount / total) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
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

  operations.forEach((op) => {
    if (op.date < start.getTime() || op.date > end.getTime()) return;
    const dateStr = formatTimestampToDay(op.date);
    const currentData = grouped.get(dateStr);
    if (!currentData) return;
    if (op.type === 'income') {
      currentData.income += op.amount;
    } else {
      currentData.expense += op.amount;
    }
    grouped.set(dateStr, currentData);
  });

  const sortedData = Array.from(grouped.entries())
    .map(([date, data]) => ({
      date,
      income: data.income,
      expense: data.expense,
      dailyProfit: data.income - data.expense,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let runningTotal = 0;
  return sortedData.map((item) => {
    runningTotal += item.dailyProfit;
    return {
      ...item,
      profit: runningTotal,
      cumulativeProfit: runningTotal,
      dailyProfit: item.dailyProfit,
    };
  });
}

export function getGoldPriceHistoryFromOperations(
  operations: FinanceOperation[],
): GoldPriceHistoryEntry[] {
  const saleOperations = operations.filter(
    (op) =>
      op.type === 'income' && op.category === 'sale' && op.gold_price_at_time && op.project_id,
  );

  const grouped = new Map<string, GoldPriceHistoryEntry>();

  saleOperations.forEach((op) => {
    const dateStr = formatTimestampToDay(op.date);
    const key = `${dateStr}_${op.project_id}`;
    const existing = grouped.get(key);

    if (existing) {
      existing.price = (existing.price + (op.gold_price_at_time || 0)) / 2;
    } else {
      grouped.set(key, {
        date: dateStr,
        price: op.gold_price_at_time || 0,
        project_id: op.project_id as 'wow_tbc' | 'wow_midnight',
      });
    }
  });

  return Array.from(grouped.values()).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
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
    if (filters.type && filters.type !== 'all' && operation.type !== filters.type) return false;
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
      if (operation.date < fromTimestamp) return false;
    }
    if (filters.dateTo) {
      const toTimestamp = parseDateToTimestamp(filters.dateTo);
      if (operation.date > toTimestamp) return false;
    }
    return true;
  });
}
