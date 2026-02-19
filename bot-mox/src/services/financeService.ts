import {
  calculateCategoryBreakdown as calculateCategoryBreakdownCore,
  calculateFinanceSummary as calculateFinanceSummaryCore,
  createFinanceOperation as createFinanceOperationCore,
  deleteFinanceOperation as deleteFinanceOperationCore,
  filterOperations as filterOperationsCore,
  formatTimestampToDay,
  getFinanceOperations as getFinanceOperationsCore,
  getGoldPriceHistoryFromOperations as getGoldPriceHistoryFromOperationsCore,
  normalizeFinanceOperationRecord,
  parseDateToTimestamp as parseDateToTimestampCore,
  prepareTimeSeriesData as prepareTimeSeriesDataCore,
  updateFinanceOperation as updateFinanceOperationCore,
} from '../entities/finance/lib/analytics';
import { formatTimestampToDate } from '../entities/finance/lib/date';
import { uiLogger } from '../observability/uiLogger';
import {
  getFinanceDailyStatsViaContract,
  getFinanceGoldPriceHistoryViaContract,
  getFinanceOperationViaContract,
} from '../providers/finance-contract-client';
import type {
  CategoryBreakdown,
  FinanceCategory,
  FinanceDailyStats,
  FinanceOperation,
  FinanceOperationFormData,
  FinanceOperationType,
  FinanceSummary,
  GoldPriceHistoryEntry,
  TimeSeriesData,
} from '../types';
import { ApiClientError, apiGet, apiPut, createPollingSubscription } from './apiClient';

const SETTINGS_API_PREFIX = '/api/v1/settings';

export interface ChartSeriesConfig {
  key: string;
  name: string;
  color: string;
  type: 'line' | 'bar';
  yAxisId: string;
  visible: boolean;
  unit: string;
}

export const parseDateToTimestamp = parseDateToTimestampCore;
export { formatTimestampToDate, formatTimestampToDay };

export async function createFinanceOperation(data: FinanceOperationFormData): Promise<string> {
  return createFinanceOperationCore(data);
}

export async function updateFinanceOperation(
  id: string,
  data: Partial<FinanceOperationFormData>,
): Promise<void> {
  await updateFinanceOperationCore(id, data);
}

export async function deleteFinanceOperation(id: string): Promise<void> {
  await deleteFinanceOperationCore(id);
}

export async function getFinanceOperations(): Promise<FinanceOperation[]> {
  return getFinanceOperationsCore();
}

export function subscribeToFinanceOperations(
  callback: (operations: FinanceOperation[]) => void,
  onError?: (error: Error) => void,
): () => void {
  return createPollingSubscription(
    async () => getFinanceOperationsCore(),
    callback,
    (error) => {
      onError?.(error);
    },
    { key: 'finance:operations', intervalMs: 4_000, immediate: true },
  );
}

export async function getFinanceOperationById(id: string): Promise<FinanceOperation | null> {
  try {
    const response = await getFinanceOperationViaContract(String(id));
    return normalizeFinanceOperationRecord(response.data);
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

function toNumber(value: unknown, fallback = 0): number {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
}

export async function getFinanceDailyStats(): Promise<Record<string, FinanceDailyStats>> {
  const response = await getFinanceDailyStatsViaContract();
  const result: Record<string, FinanceDailyStats> = {};

  for (const [entryKey, entryValue] of Object.entries(response.data || {})) {
    const source =
      entryValue && typeof entryValue === 'object'
        ? (entryValue as Record<string, unknown>)
        : ({} as Record<string, unknown>);
    const totalFarmed =
      source.total_farmed && typeof source.total_farmed === 'object'
        ? (source.total_farmed as FinanceDailyStats['total_farmed'])
        : {};

    result[entryKey] = {
      date: typeof source.date === 'string' ? source.date : entryKey,
      total_expenses: toNumber(source.total_expenses),
      total_revenue: toNumber(source.total_revenue),
      net_profit: toNumber(source.net_profit),
      active_bots: Math.max(0, Math.trunc(toNumber(source.active_bots))),
      total_farmed: totalFarmed,
    };
  }

  return result;
}

export function getGoldPriceHistoryFromOperations(
  operations: FinanceOperation[],
): GoldPriceHistoryEntry[] {
  return getGoldPriceHistoryFromOperationsCore(operations);
}

/**
 * @deprecated Use getGoldPriceHistoryFromOperations from operations.
 */
export async function getGoldPriceHistory(): Promise<Record<string, { price: number }>> {
  const response = await getFinanceGoldPriceHistoryViaContract();
  return response.data;
}

export function calculateFinanceSummary(operations: FinanceOperation[]): FinanceSummary {
  return calculateFinanceSummaryCore(operations);
}

export function calculateCategoryBreakdown(
  operations: FinanceOperation[],
  type: FinanceOperationType,
): CategoryBreakdown[] {
  return calculateCategoryBreakdownCore(operations, type);
}

export function prepareTimeSeriesData(
  operations: FinanceOperation[],
  startDate: number,
  endDate: number,
): TimeSeriesData[] {
  return prepareTimeSeriesDataCore(operations, startDate, endDate);
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
  return filterOperationsCore(operations, filters);
}

export async function getCurrentGoldPrice(projectId: 'wow_tbc' | 'wow_midnight'): Promise<number> {
  try {
    const response = await apiGet<unknown>(
      `${SETTINGS_API_PREFIX}/projects/${encodeURIComponent(projectId)}/gold_price_usd`,
    );
    const rawValue = Number(response.data);
    if (Number.isFinite(rawValue) && rawValue > 0) {
      return rawValue * 1000;
    }
    return projectId === 'wow_tbc' ? 12.5 : 8.5;
  } catch (error) {
    uiLogger.error('Error getting gold price:', error);
    return projectId === 'wow_tbc' ? 12.5 : 8.5;
  }
}

export async function saveChartConfig(config: ChartSeriesConfig[]): Promise<void> {
  await apiPut(`${SETTINGS_API_PREFIX}/finance/chart_config`, config);
}

export async function getChartConfig(): Promise<ChartSeriesConfig[] | null> {
  try {
    const response = await apiGet<unknown>(`${SETTINGS_API_PREFIX}/finance/chart_config`);
    return Array.isArray(response.data) ? (response.data as ChartSeriesConfig[]) : null;
  } catch (error) {
    uiLogger.error('Error fetching chart config:', error);
    return null;
  }
}
