import dayjs from 'dayjs';
import type {
  CategoryBreakdown,
  FinanceCategory,
  FinanceSummary as FinanceSummaryModel,
  GoldPriceHistoryEntry,
  TimeSeriesData,
} from '../../entities/finance/model/types';
import type {
  FinanceBreakdownContractRecord,
  FinanceGoldPriceHistoryContractMap,
  FinanceSummaryContractRecord,
  FinanceTimeSeriesContractRecord,
} from '../../shared/api/providers/finance-contract-client';

const FINANCE_CATEGORY_SET = new Set<FinanceCategory>([
  'subscription_game',
  'proxy',
  'bot_license',
  'other',
  'sale',
]);

function toFinanceCategory(value: unknown): FinanceCategory {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (FINANCE_CATEGORY_SET.has(normalized as FinanceCategory)) {
    return normalized as FinanceCategory;
  }
  return 'other';
}

function toFiniteNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function mapGoldPriceHistoryFromContract(
  history: FinanceGoldPriceHistoryContractMap | undefined,
  selectedProject: 'all' | 'wow_tbc' | 'wow_midnight',
): GoldPriceHistoryEntry[] {
  const points = Object.entries(history || {})
    .map(([date, entry]) => ({
      date,
      price: toFiniteNumber(entry?.price),
    }))
    .filter((entry) => entry.price > 0)
    .sort((left, right) => dayjs(left.date).valueOf() - dayjs(right.date).valueOf());

  if (selectedProject === 'all') {
    return points.flatMap((entry) => [
      { date: entry.date, price: entry.price, project_id: 'wow_tbc' as const },
      { date: entry.date, price: entry.price, project_id: 'wow_midnight' as const },
    ]);
  }

  return points.map((entry) => ({
    date: entry.date,
    price: entry.price,
    project_id: selectedProject,
  }));
}

export function mapBreakdownFromAggregate(
  breakdown: FinanceBreakdownContractRecord | undefined,
  type: 'income' | 'expense',
): CategoryBreakdown[] {
  const sourceItems = (breakdown?.items || []) as Array<Record<string, unknown>>;
  const mapped = sourceItems
    .map((item: Record<string, unknown>) => {
      const typedItem = item as Record<string, unknown>;
      const amount =
        type === 'income'
          ? toFiniteNumber(typedItem.income_total)
          : toFiniteNumber(typedItem.expense_total);
      return {
        category: toFinanceCategory(typedItem.key),
        amount,
      };
    })
    .filter((entry: { category: FinanceCategory; amount: number }) => entry.amount > 0);

  const total = mapped.reduce(
    (accumulator: number, entry: { category: FinanceCategory; amount: number }) =>
      accumulator + entry.amount,
    0,
  );
  return mapped
    .map((entry: { category: FinanceCategory; amount: number }) => ({
      ...entry,
      percentage: total > 0 ? Math.round((entry.amount / total) * 100) : 0,
    }))
    .sort((left: { amount: number }, right: { amount: number }) => right.amount - left.amount);
}

export function mapSummaryFromAggregate(
  summary: FinanceSummaryContractRecord | undefined,
): FinanceSummaryModel {
  const summaryRecord = (summary || {}) as Record<string, unknown>;
  return {
    totalIncome: toFiniteNumber(summary?.income_total),
    totalExpenses: toFiniteNumber(summary?.expense_total),
    netProfit: toFiniteNumber(summary?.net_total),
    totalGoldSold: toFiniteNumber(summaryRecord.total_gold_sold),
    totalGoldFarmed: toFiniteNumber(summaryRecord.total_gold_farmed),
    averageGoldPrice: toFiniteNumber(summaryRecord.average_gold_price),
  };
}

export function mapTimeSeriesFromAggregate(
  timeSeries: FinanceTimeSeriesContractRecord | undefined,
): TimeSeriesData[] {
  if (!timeSeries?.points) {
    return [];
  }

  const sortedPoints = [...timeSeries.points].sort(
    (left, right) =>
      dayjs(String(left.bucket || '')).valueOf() - dayjs(String(right.bucket || '')).valueOf(),
  );

  let cumulativeProfit = 0;
  return sortedPoints.map((point) => {
    const income = toFiniteNumber(point.income_total);
    const expense = toFiniteNumber(point.expense_total);
    const dailyProfit =
      point.net_total === undefined || point.net_total === null
        ? income - expense
        : toFiniteNumber(point.net_total);
    cumulativeProfit += dailyProfit;
    return {
      date: String(point.bucket || ''),
      income,
      expense,
      dailyProfit,
      profit: cumulativeProfit,
      cumulativeProfit,
    };
  });
}
