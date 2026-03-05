import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  type FinanceCategoryAggregateRow,
  type FinanceDailyStatsAggregateRow,
  type FinanceGoldPriceHistoryAggregateRow,
  type FinanceProjectAggregateRow,
  FinanceRepository,
  type FinanceSummaryAggregateRow,
} from './finance.repository';

type FinanceOperationRecord = Record<string, unknown>;

export interface FinanceListQuery {
  page?: number | undefined;
  limit?: number | undefined;
  sort?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
  q?: string | undefined;
}

export interface FinanceListResult {
  items: FinanceOperationRecord[];
  total: number;
  page: number;
  limit: number;
}

export interface FinanceAggregateQuery {
  from_ts?: number | undefined;
  to_ts?: number | undefined;
  currency?: string | undefined;
  project_id?: string | undefined;
  bot_id?: string | undefined;
}

export interface FinanceTimeSeriesQuery extends FinanceAggregateQuery {
  granularity?: 'hour' | 'day' | 'week' | 'month' | undefined;
}

export interface FinanceSummaryDto {
  income_total: number;
  expense_total: number;
  net_total: number;
  margin_percent: number;
  operation_count: number;
  total_gold_sold: number;
  total_gold_farmed: number;
  average_gold_price: number;
  period: {
    from_ts?: number;
    to_ts?: number;
  };
}

export interface FinanceBreakdownItemDto {
  key: string;
  label: string;
  amount: number;
  share_percent: number;
  count: number;
  income_total: number;
  expense_total: number;
  net_total: number;
}

export interface FinanceProjectPerformanceItemDto {
  project_id: string;
  income_total: number;
  expense_total: number;
  net_total: number;
  margin_percent: number;
  operation_count: number;
  gold_volume: number;
  average_gold_price: number;
}

export interface FinanceProjectPerformanceDto {
  source: 'finance_breakdown_aggregate';
  items: FinanceProjectPerformanceItemDto[];
}

export interface FinanceBreakdownDto {
  group_by: 'category';
  items: FinanceBreakdownItemDto[];
  totals: FinanceSummaryDto;
  project_performance: FinanceProjectPerformanceDto;
}

export interface FinanceTimeSeriesPointDto {
  bucket: string;
  income_total: number;
  expense_total: number;
  net_total: number;
  operation_count: number;
  daily_profit: number;
  cumulative_profit: number;
}

export interface FinanceTimeSeriesDto {
  granularity: 'hour' | 'day' | 'week' | 'month';
  points: FinanceTimeSeriesPointDto[];
  totals: FinanceSummaryDto;
}

@Injectable()
export class FinanceService {
  constructor(private readonly repository: FinanceRepository) {}

  private normalizeTenantId(tenantId: string): string {
    const normalized = String(tenantId || '')
      .trim()
      .toLowerCase();
    if (!normalized) {
      throw new Error('tenantId is required');
    }
    return normalized;
  }

  private normalizeSearchValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'string') {
      return value.toLowerCase();
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value).toLowerCase();
    }

    return '';
  }

  private makeId(): string {
    const stamp = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 8);
    return `fin-${stamp}-${random}`;
  }

  private toDay(value: unknown): string {
    const timestamp = Number(value);
    const date = Number.isFinite(timestamp) ? new Date(timestamp) : new Date();
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private normalizeExactFilter(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }
    const normalized = value.trim().toLowerCase();
    return normalized.length > 0 ? normalized : undefined;
  }

  private normalizeTimestamp(value: unknown): number | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }
    const asNumber = Number(value);
    if (!Number.isFinite(asNumber)) {
      return undefined;
    }
    return Math.trunc(asNumber);
  }

  private normalizeAmount(value: unknown): number {
    const amount = Number(value);
    return Number.isFinite(amount) ? amount : 0;
  }

  private normalizeCount(value: unknown): number {
    const count = Number(value);
    return Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
  }

  private toDecimal(value: unknown): Prisma.Decimal {
    if (value instanceof Prisma.Decimal) {
      return value;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return new Prisma.Decimal(value);
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return new Prisma.Decimal(0);
      }
      return new Prisma.Decimal(trimmed);
    }

    if (typeof value === 'bigint') {
      return new Prisma.Decimal(value.toString());
    }

    return new Prisma.Decimal(0);
  }

  private mapSummaryAggregate(
    aggregate: FinanceSummaryAggregateRow,
    query: FinanceAggregateQuery,
  ): FinanceSummaryDto {
    const incomeTotal = this.toDecimal(aggregate.incomeTotal);
    const expenseTotal = this.toDecimal(aggregate.expenseTotal);
    const totalGoldSold = this.toDecimal(aggregate.totalGoldSold);
    const totalGoldFarmed = this.toDecimal(aggregate.totalGoldFarmed);
    const saleIncomeTotal = this.toDecimal(aggregate.saleIncomeTotal);

    const netTotal = incomeTotal.sub(expenseTotal);
    const marginPercent = incomeTotal.gt(0)
      ? netTotal.div(incomeTotal).mul(100)
      : new Prisma.Decimal(0);
    const averageGoldPrice = totalGoldSold.gt(0)
      ? saleIncomeTotal.mul(1000).div(totalGoldSold)
      : new Prisma.Decimal(0);

    const fromTs = this.normalizeTimestamp(query.from_ts);
    const toTs = this.normalizeTimestamp(query.to_ts);
    const period: { from_ts?: number; to_ts?: number } = {};
    if (fromTs !== undefined) {
      period.from_ts = fromTs;
    }
    if (toTs !== undefined) {
      period.to_ts = toTs;
    }

    return {
      income_total: incomeTotal.toNumber(),
      expense_total: expenseTotal.toNumber(),
      net_total: netTotal.toNumber(),
      margin_percent: marginPercent.toNumber(),
      operation_count: this.normalizeCount(aggregate.operationCount),
      total_gold_sold: totalGoldSold.toNumber(),
      total_gold_farmed: totalGoldFarmed.toNumber(),
      average_gold_price: averageGoldPrice.toNumber(),
      period,
    };
  }

  private toRepositoryAggregateFilters(query: FinanceAggregateQuery): {
    fromTs?: number;
    toTs?: number;
    currency?: string;
    projectId?: string;
    botId?: string;
  } {
    const fromTs = this.normalizeTimestamp(query.from_ts);
    const toTs = this.normalizeTimestamp(query.to_ts);
    const currency = this.normalizeExactFilter(query.currency);
    const projectId = this.normalizeExactFilter(query.project_id);
    const botId = this.normalizeExactFilter(query.bot_id);

    return {
      ...(fromTs !== undefined ? { fromTs } : {}),
      ...(toTs !== undefined ? { toTs } : {}),
      ...(currency !== undefined ? { currency } : {}),
      ...(projectId !== undefined ? { projectId } : {}),
      ...(botId !== undefined ? { botId } : {}),
    };
  }

  private normalizeType(value: unknown): 'income' | 'expense' | undefined {
    return value === 'income' || value === 'expense' ? value : undefined;
  }

  private normalizeGranularity(value: unknown): 'hour' | 'day' | 'week' | 'month' {
    if (value === 'hour' || value === 'day' || value === 'week' || value === 'month') {
      return value;
    }
    return 'day';
  }

  private floorUtcToHour(timestamp: number): number {
    const date = new Date(timestamp);
    date.setUTCMinutes(0, 0, 0);
    return date.getTime();
  }

  private floorUtcToDay(timestamp: number): number {
    const date = new Date(timestamp);
    date.setUTCHours(0, 0, 0, 0);
    return date.getTime();
  }

  private floorUtcToWeek(timestamp: number): number {
    const dayStart = new Date(this.floorUtcToDay(timestamp));
    const dayOfWeek = dayStart.getUTCDay();
    const offsetToMonday = (dayOfWeek + 6) % 7;
    dayStart.setUTCDate(dayStart.getUTCDate() - offsetToMonday);
    return dayStart.getTime();
  }

  private floorUtcToMonth(timestamp: number): number {
    const date = new Date(timestamp);
    date.setUTCDate(1);
    date.setUTCHours(0, 0, 0, 0);
    return date.getTime();
  }

  private stepBucket(bucketStart: number, granularity: 'hour' | 'day' | 'week' | 'month'): number {
    if (granularity === 'hour') {
      return bucketStart + 60 * 60 * 1000;
    }
    if (granularity === 'day') {
      return bucketStart + 24 * 60 * 60 * 1000;
    }
    if (granularity === 'week') {
      return bucketStart + 7 * 24 * 60 * 60 * 1000;
    }
    const date = new Date(bucketStart);
    date.setUTCMonth(date.getUTCMonth() + 1);
    return date.getTime();
  }

  private getBucketStart(
    timestamp: number,
    granularity: 'hour' | 'day' | 'week' | 'month',
  ): number {
    if (granularity === 'hour') {
      return this.floorUtcToHour(timestamp);
    }
    if (granularity === 'day') {
      return this.floorUtcToDay(timestamp);
    }
    if (granularity === 'week') {
      return this.floorUtcToWeek(timestamp);
    }
    return this.floorUtcToMonth(timestamp);
  }

  private formatBucket(
    bucketStart: number,
    granularity: 'hour' | 'day' | 'week' | 'month',
  ): string {
    const date = new Date(bucketStart);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');

    if (granularity === 'month') {
      return `${year}-${month}`;
    }
    if (granularity === 'hour') {
      const hour = String(date.getUTCHours()).padStart(2, '0');
      return `${year}-${month}-${day}T${hour}:00:00Z`;
    }
    return `${year}-${month}-${day}`;
  }

  private filterOperationsByAggregateQuery(
    items: FinanceOperationRecord[],
    query: FinanceAggregateQuery,
  ): FinanceOperationRecord[] {
    const fromTs = this.normalizeTimestamp(query.from_ts);
    const toTs = this.normalizeTimestamp(query.to_ts);
    const currency = this.normalizeExactFilter(query.currency);
    const projectId = this.normalizeExactFilter(query.project_id);
    const botId = this.normalizeExactFilter(query.bot_id);

    return items.filter((item) => {
      const operationTs = this.normalizeTimestamp(item.date ?? item.created_at);
      if (fromTs !== undefined && (operationTs === undefined || operationTs < fromTs)) {
        return false;
      }
      if (toTs !== undefined && (operationTs === undefined || operationTs > toTs)) {
        return false;
      }

      if (currency !== undefined) {
        const operationCurrency = this.normalizeExactFilter(item.currency);
        if (operationCurrency !== currency) {
          return false;
        }
      }

      if (projectId !== undefined) {
        const operationProjectId = this.normalizeExactFilter(item.project_id);
        if (operationProjectId !== projectId) {
          return false;
        }
      }

      if (botId !== undefined) {
        const operationBotId = this.normalizeExactFilter(item.bot_id);
        if (operationBotId !== botId) {
          return false;
        }
      }

      return true;
    });
  }

  private buildSummary(
    items: FinanceOperationRecord[],
    query: FinanceAggregateQuery,
  ): FinanceSummaryDto {
    let incomeTotal = 0;
    let expenseTotal = 0;
    let saleIncomeTotal = 0;
    let totalGoldSold = 0;
    let totalGoldFarmed = 0;
    const fromTs = this.normalizeTimestamp(query.from_ts);
    const toTs = this.normalizeTimestamp(query.to_ts);

    for (const item of items) {
      const amount = this.normalizeAmount(item.amount);
      const type = this.normalizeType(item.type);
      const category = typeof item.category === 'string' ? item.category.trim().toLowerCase() : '';
      const goldAmount = this.normalizeAmount(item.gold_amount);
      if (type === 'income') {
        incomeTotal += amount;
        if (goldAmount > 0) {
          totalGoldFarmed += goldAmount;
          if (category === 'sale') {
            totalGoldSold += goldAmount;
            saleIncomeTotal += amount;
          }
        }
      } else if (type === 'expense') {
        expenseTotal += amount;
      }
    }

    const netTotal = incomeTotal - expenseTotal;
    const marginPercent = incomeTotal > 0 ? (netTotal / incomeTotal) * 100 : 0;
    const period: { from_ts?: number; to_ts?: number } = {};
    if (fromTs !== undefined) {
      period.from_ts = fromTs;
    }
    if (toTs !== undefined) {
      period.to_ts = toTs;
    }

    return {
      income_total: incomeTotal,
      expense_total: expenseTotal,
      net_total: netTotal,
      margin_percent: marginPercent,
      operation_count: items.length,
      total_gold_sold: totalGoldSold,
      total_gold_farmed: totalGoldFarmed,
      average_gold_price: totalGoldSold > 0 ? (saleIncomeTotal * 1000) / totalGoldSold : 0,
      period,
    };
  }

  private buildTimeSeriesPoints(
    items: FinanceOperationRecord[],
    query: FinanceTimeSeriesQuery,
  ): FinanceTimeSeriesPointDto[] {
    const granularity = this.normalizeGranularity(query.granularity);
    const pointsByBucket = new Map<
      number,
      {
        incomeTotal: number;
        expenseTotal: number;
        operationCount: number;
      }
    >();

    const fromTs = this.normalizeTimestamp(query.from_ts);
    const toTs = this.normalizeTimestamp(query.to_ts);

    for (const item of items) {
      const operationTs = this.normalizeTimestamp(item.date ?? item.created_at);
      if (operationTs === undefined) {
        continue;
      }

      const bucketStart = this.getBucketStart(operationTs, granularity);
      const current = pointsByBucket.get(bucketStart) ?? {
        incomeTotal: 0,
        expenseTotal: 0,
        operationCount: 0,
      };
      const amount = this.normalizeAmount(item.amount);
      const type = this.normalizeType(item.type);
      if (type === 'income') {
        current.incomeTotal += amount;
      } else if (type === 'expense') {
        current.expenseTotal += amount;
      }
      current.operationCount += 1;
      pointsByBucket.set(bucketStart, current);
    }

    if (fromTs !== undefined && toTs !== undefined) {
      const startBucket = this.getBucketStart(fromTs, granularity);
      const endBucket = this.getBucketStart(toTs, granularity);
      for (
        let bucketStart = startBucket;
        bucketStart <= endBucket;
        bucketStart = this.stepBucket(bucketStart, granularity)
      ) {
        if (!pointsByBucket.has(bucketStart)) {
          pointsByBucket.set(bucketStart, {
            incomeTotal: 0,
            expenseTotal: 0,
            operationCount: 0,
          });
        }
      }
    }

    const sortedPoints = [...pointsByBucket.entries()].sort(([left], [right]) => left - right);
    let cumulativeProfit = 0;
    return sortedPoints.map(([bucketStart, aggregate]) => {
      const dailyProfit = aggregate.incomeTotal - aggregate.expenseTotal;
      cumulativeProfit += dailyProfit;
      return {
        bucket: this.formatBucket(bucketStart, granularity),
        income_total: aggregate.incomeTotal,
        expense_total: aggregate.expenseTotal,
        net_total: dailyProfit,
        operation_count: aggregate.operationCount,
        daily_profit: dailyProfit,
        cumulative_profit: cumulativeProfit,
      };
    });
  }

  private applyListQuery(
    items: FinanceOperationRecord[],
    query: FinanceListQuery,
  ): FinanceListResult {
    const order = query.order === 'desc' ? 'desc' : 'asc';
    const page = Number.isFinite(query.page) && (query.page ?? 0) > 0 ? Number(query.page) : 1;
    const limit = Number.isFinite(query.limit) && (query.limit ?? 0) > 0 ? Number(query.limit) : 50;
    const q = String(query.q || '')
      .trim()
      .toLowerCase();
    const sort = String(query.sort || '').trim();

    let data = [...items];

    if (q) {
      data = data.filter((item) =>
        Object.values(item).some((value) => this.normalizeSearchValue(value).includes(q)),
      );
    }

    if (sort) {
      data.sort((left, right) => {
        const a = left?.[sort];
        const b = right?.[sort];

        if (a === b) return 0;
        if (a === undefined || a === null) return order === 'asc' ? -1 : 1;
        if (b === undefined || b === null) return order === 'asc' ? 1 : -1;
        if (a > b) return order === 'asc' ? 1 : -1;
        return order === 'asc' ? -1 : 1;
      });
    }

    const total = data.length;
    const start = (page - 1) * limit;
    const end = start + limit;

    return {
      items: data.slice(start, end),
      total,
      page,
      limit,
    };
  }

  private mapDbRow(row: Record<string, unknown>): FinanceOperationRecord {
    const id = String(row.id || '').trim();
    const payload = row.payload;
    if (payload && typeof payload === 'object') {
      return { ...(payload as FinanceOperationRecord), ...(id ? { id } : {}) };
    }
    return id ? { id } : {};
  }

  async list(query: FinanceListQuery, tenantId: string): Promise<FinanceListResult> {
    const normalizedTenantId = this.normalizeTenantId(tenantId);
    const rows = await this.repository.list(normalizedTenantId);
    return this.applyListQuery(
      rows.map((row) => this.mapDbRow(row)),
      query,
    );
  }

  async getById(id: string, tenantId: string): Promise<FinanceOperationRecord | null> {
    const normalizedTenantId = this.normalizeTenantId(tenantId);
    const row = await this.repository.findById(normalizedTenantId, id);
    return row ? this.mapDbRow(row) : null;
  }

  async create(
    payload: FinanceOperationRecord,
    explicitId: string | undefined,
    tenantId: string,
  ): Promise<FinanceOperationRecord> {
    const normalizedTenantId = this.normalizeTenantId(tenantId);
    const rawId = typeof explicitId === 'string' ? explicitId.trim() : '';
    const payloadId = typeof payload.id === 'string' ? payload.id.trim() : '';
    const id = rawId || payloadId || this.makeId();
    const now = Date.now();

    const nextRecord = {
      ...payload,
      id,
      created_at: payload.created_at ?? now,
      updated_at: now,
    };
    const row = await this.repository.upsert({
      tenantId: normalizedTenantId,
      id,
      payload: nextRecord as Prisma.InputJsonValue,
    });
    return this.mapDbRow(row);
  }

  async patch(
    id: string,
    payload: FinanceOperationRecord,
    tenantId: string,
  ): Promise<FinanceOperationRecord | null> {
    const normalizedTenantId = this.normalizeTenantId(tenantId);
    const dbCurrent = await this.repository.findById(normalizedTenantId, id);
    const current = dbCurrent ? this.mapDbRow(dbCurrent) : null;

    if (!current) {
      return null;
    }

    const nextRecord = {
      ...current,
      ...payload,
      id,
      updated_at: Date.now(),
    };
    const row = await this.repository.upsert({
      tenantId: normalizedTenantId,
      id,
      payload: nextRecord as Prisma.InputJsonValue,
    });
    return this.mapDbRow(row);
  }

  async remove(id: string, tenantId: string): Promise<boolean> {
    const normalizedTenantId = this.normalizeTenantId(tenantId);
    return this.repository.delete(normalizedTenantId, id);
  }

  async getDailyStats(tenantId: string): Promise<Record<string, Record<string, unknown>>> {
    const normalizedTenantId = this.normalizeTenantId(tenantId);
    const stats: Record<string, Record<string, unknown>> = {};
    const aggregateRows = await this.repository.getDailyStatsAggregate(normalizedTenantId);

    for (const row of aggregateRows) {
      const bucketTs = this.normalizeTimestamp((row as FinanceDailyStatsAggregateRow).bucketTs);
      if (bucketTs === undefined) {
        continue;
      }

      const dateKey = this.toDay(bucketTs);
      const incomeTotal = this.toDecimal(
        (row as FinanceDailyStatsAggregateRow).incomeTotal,
      ).toNumber();
      const expenseTotal = this.toDecimal(
        (row as FinanceDailyStatsAggregateRow).expenseTotal,
      ).toNumber();
      const activeBots = this.normalizeCount((row as FinanceDailyStatsAggregateRow).activeBots);

      stats[dateKey] = {
        date: dateKey,
        total_expenses: expenseTotal,
        total_revenue: incomeTotal,
        net_profit: incomeTotal - expenseTotal,
        active_bots: activeBots,
        total_farmed: {},
      };
    }

    return stats;
  }

  async getGoldPriceHistory(tenantId: string): Promise<Record<string, { price: number }>> {
    const normalizedTenantId = this.normalizeTenantId(tenantId);
    const result: Record<string, { price: number }> = {};
    const aggregateRows = await this.repository.getGoldPriceHistoryAggregate(normalizedTenantId);
    for (const row of aggregateRows) {
      const bucketTs = this.normalizeTimestamp(
        (row as FinanceGoldPriceHistoryAggregateRow).bucketTs,
      );
      if (bucketTs === undefined) {
        continue;
      }

      const price = this.toDecimal(
        (row as FinanceGoldPriceHistoryAggregateRow).avgGoldPrice,
      ).toNumber();
      if (!Number.isFinite(price) || price <= 0) {
        continue;
      }

      result[this.toDay(bucketTs)] = { price };
    }
    return result;
  }

  async getSummary(query: FinanceAggregateQuery, tenantId: string): Promise<FinanceSummaryDto> {
    const normalizedTenantId = this.normalizeTenantId(tenantId);
    const aggregate = await this.repository.getSummaryAggregate(
      normalizedTenantId,
      this.toRepositoryAggregateFilters(query),
    );
    return this.mapSummaryAggregate(aggregate, query);
  }

  async getBreakdown(query: FinanceAggregateQuery, tenantId: string): Promise<FinanceBreakdownDto> {
    const normalizedTenantId = this.normalizeTenantId(tenantId);
    const filters = this.toRepositoryAggregateFilters(query);
    const [summaryAggregate, categoryRows, projectRows] = await Promise.all([
      this.repository.getSummaryAggregate(normalizedTenantId, filters),
      this.repository.getCategoryBreakdownAggregate(normalizedTenantId, filters),
      this.repository.getProjectPerformanceAggregate(normalizedTenantId, filters),
    ]);
    const totals = this.mapSummaryAggregate(summaryAggregate, query);

    const totalAmount = categoryRows.reduce(
      (acc, row) => acc.add(this.toDecimal(row.amount)),
      new Prisma.Decimal(0),
    );
    const totalAmountNumber = totalAmount.toNumber();
    const items: FinanceBreakdownItemDto[] = categoryRows
      .map((row: FinanceCategoryAggregateRow) => {
        const amount = this.toDecimal(row.amount);
        const incomeTotal = this.toDecimal(row.incomeTotal);
        const expenseTotal = this.toDecimal(row.expenseTotal);
        const amountNumber = amount.toNumber();
        const key = String(row.key ?? 'uncategorized');
        const label = String(row.label ?? key);
        return {
          key,
          label,
          amount: amountNumber,
          share_percent: totalAmountNumber > 0 ? (amountNumber / totalAmountNumber) * 100 : 0,
          count: this.normalizeCount(row.count),
          income_total: incomeTotal.toNumber(),
          expense_total: expenseTotal.toNumber(),
          net_total: incomeTotal.sub(expenseTotal).toNumber(),
        };
      })
      .sort((left, right) => {
        if (right.amount !== left.amount) {
          return right.amount - left.amount;
        }
        return left.key.localeCompare(right.key);
      });

    const projectPerformanceItems: FinanceProjectPerformanceItemDto[] = projectRows
      .map((row: FinanceProjectAggregateRow) => {
        const incomeTotal = this.toDecimal(row.incomeTotal);
        const expenseTotal = this.toDecimal(row.expenseTotal);
        const goldVolume = this.toDecimal(row.goldVolume);
        const saleIncomeTotal = this.toDecimal(row.saleIncomeTotal);
        const netTotal = incomeTotal.sub(expenseTotal);
        return {
          project_id: String(row.projectId ?? 'global'),
          income_total: incomeTotal.toNumber(),
          expense_total: expenseTotal.toNumber(),
          net_total: netTotal.toNumber(),
          margin_percent: incomeTotal.gt(0) ? netTotal.div(incomeTotal).mul(100).toNumber() : 0,
          operation_count: this.normalizeCount(row.operationCount),
          gold_volume: goldVolume.toNumber(),
          average_gold_price: goldVolume.gt(0)
            ? saleIncomeTotal.mul(1000).div(goldVolume).toNumber()
            : 0,
        };
      })
      .sort((left, right) => {
        if (right.net_total !== left.net_total) {
          return right.net_total - left.net_total;
        }
        return left.project_id.localeCompare(right.project_id);
      });

    return {
      group_by: 'category',
      items,
      totals,
      project_performance: {
        source: 'finance_breakdown_aggregate',
        items: projectPerformanceItems,
      },
    };
  }

  async getTimeSeries(
    query: FinanceTimeSeriesQuery,
    tenantId: string,
  ): Promise<FinanceTimeSeriesDto> {
    const normalizedTenantId = this.normalizeTenantId(tenantId);
    const granularity = this.normalizeGranularity(query.granularity);
    const filters = this.toRepositoryAggregateFilters(query);
    const [summaryAggregate, aggregateRows] = await Promise.all([
      this.repository.getSummaryAggregate(normalizedTenantId, filters),
      this.repository.getTimeSeriesAggregate(normalizedTenantId, filters, granularity),
    ]);

    const pointsByBucket = new Map<
      number,
      {
        incomeTotal: Prisma.Decimal;
        expenseTotal: Prisma.Decimal;
        operationCount: number;
      }
    >();

    for (const row of aggregateRows) {
      const bucketStart = this.normalizeTimestamp(row.bucketTs);
      if (bucketStart === undefined) {
        continue;
      }
      pointsByBucket.set(bucketStart, {
        incomeTotal: this.toDecimal(row.incomeTotal),
        expenseTotal: this.toDecimal(row.expenseTotal),
        operationCount: this.normalizeCount(row.operationCount),
      });
    }

    const fromTs = this.normalizeTimestamp(query.from_ts);
    const toTs = this.normalizeTimestamp(query.to_ts);
    if (fromTs !== undefined && toTs !== undefined) {
      const startBucket = this.getBucketStart(fromTs, granularity);
      const endBucket = this.getBucketStart(toTs, granularity);
      for (
        let bucketStart = startBucket;
        bucketStart <= endBucket;
        bucketStart = this.stepBucket(bucketStart, granularity)
      ) {
        if (!pointsByBucket.has(bucketStart)) {
          pointsByBucket.set(bucketStart, {
            incomeTotal: new Prisma.Decimal(0),
            expenseTotal: new Prisma.Decimal(0),
            operationCount: 0,
          });
        }
      }
    }

    const sortedPoints = [...pointsByBucket.entries()].sort(([left], [right]) => left - right);
    let cumulativeProfit = new Prisma.Decimal(0);
    const points = sortedPoints.map(([bucketStart, entry]) => {
      const dailyProfit = entry.incomeTotal.sub(entry.expenseTotal);
      cumulativeProfit = cumulativeProfit.add(dailyProfit);
      return {
        bucket: this.formatBucket(bucketStart, granularity),
        income_total: entry.incomeTotal.toNumber(),
        expense_total: entry.expenseTotal.toNumber(),
        net_total: dailyProfit.toNumber(),
        operation_count: entry.operationCount,
        daily_profit: dailyProfit.toNumber(),
        cumulative_profit: cumulativeProfit.toNumber(),
      };
    });

    return {
      granularity,
      points,
      totals: this.mapSummaryAggregate(summaryAggregate, query),
    };
  }
}
