import dayjs from 'dayjs';
import type {
  CategoryBreakdown,
  FinanceCategory,
  FinanceOperation,
  FinanceSummary as FinanceSummaryModel,
  GoldPriceHistoryEntry,
  TimeSeriesData,
} from '../../entities/finance/model/types';
import type {
  FinanceBreakdownContractRecord,
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

export function getGoldPriceHistoryFromOperationsLocal(
  operations: FinanceOperation[],
): GoldPriceHistoryEntry[] {
  const grouped = new Map<string, GoldPriceHistoryEntry>();

  operations
    .filter(
      (operation) =>
        operation.type === 'income' &&
        operation.category === 'sale' &&
        typeof operation.gold_price_at_time === 'number' &&
        operation.gold_price_at_time > 0 &&
        operation.project_id,
    )
    .forEach((operation) => {
      const date = dayjs(operation.date).format('YYYY-MM-DD');
      const projectId = operation.project_id as 'wow_tbc' | 'wow_midnight';
      const key = `${date}_${projectId}`;
      const existing = grouped.get(key);
      if (!existing) {
        grouped.set(key, {
          date,
          price: operation.gold_price_at_time || 0,
          project_id: projectId,
        });
        return;
      }
      existing.price = (existing.price + (operation.gold_price_at_time || 0)) / 2;
      grouped.set(key, existing);
    });

  return [...grouped.values()].sort(
    (left, right) => dayjs(left.date).valueOf() - dayjs(right.date).valueOf(),
  );
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
  return {
    totalIncome: toFiniteNumber(summary?.income_total),
    totalExpenses: toFiniteNumber(summary?.expense_total),
    netProfit: toFiniteNumber(summary?.net_total),
    totalGoldSold: 0,
    totalGoldFarmed: 0,
    averageGoldPrice: 0,
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
