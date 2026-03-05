import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { FinanceRepository } from './finance.repository';

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
    const activeBotsByDate = new Map<string, Set<string>>();
    const source = (await this.repository.list(normalizedTenantId)).map((row) =>
      this.mapDbRow(row),
    );

    for (const operation of source) {
      const dateKey = this.toDay(operation.date ?? operation.created_at);
      const amount = Number(operation.amount || 0);
      const type = operation.type === 'expense' ? 'expense' : 'income';

      if (!stats[dateKey]) {
        stats[dateKey] = {
          date: dateKey,
          total_expenses: 0,
          total_revenue: 0,
          net_profit: 0,
          active_bots: 0,
          total_farmed: {},
        };
      }

      if (type === 'expense') {
        stats[dateKey].total_expenses = Number(stats[dateKey].total_expenses || 0) + amount;
      } else {
        stats[dateKey].total_revenue = Number(stats[dateKey].total_revenue || 0) + amount;
      }

      stats[dateKey].net_profit =
        Number(stats[dateKey].total_revenue || 0) - Number(stats[dateKey].total_expenses || 0);

      const botId = typeof operation.bot_id === 'string' ? operation.bot_id.trim() : '';
      if (botId) {
        const bucket = activeBotsByDate.get(dateKey) ?? new Set<string>();
        bucket.add(botId);
        activeBotsByDate.set(dateKey, bucket);
      }
    }

    for (const [dateKey, bucket] of activeBotsByDate.entries()) {
      if (!stats[dateKey]) continue;
      stats[dateKey].active_bots = bucket.size;
    }

    return stats;
  }

  async getGoldPriceHistory(tenantId: string): Promise<Record<string, { price: number }>> {
    const normalizedTenantId = this.normalizeTenantId(tenantId);
    const sums = new Map<string, { total: number; count: number }>();
    const source = (await this.repository.list(normalizedTenantId)).map((row) =>
      this.mapDbRow(row),
    );

    for (const operation of source) {
      const isSale = operation.type === 'income' && operation.category === 'sale';
      const rawPrice = operation.gold_price_at_time;
      const price = Number(rawPrice);
      if (!isSale || !Number.isFinite(price) || price <= 0) continue;

      const dateKey = this.toDay(operation.date ?? operation.created_at);
      const current = sums.get(dateKey) ?? { total: 0, count: 0 };
      current.total += price;
      current.count += 1;
      sums.set(dateKey, current);
    }

    const result: Record<string, { price: number }> = {};
    for (const [date, aggregate] of sums.entries()) {
      if (aggregate.count <= 0) continue;
      result[date] = {
        price: aggregate.total / aggregate.count,
      };
    }
    return result;
  }

  async getSummary(query: FinanceAggregateQuery, tenantId: string): Promise<FinanceSummaryDto> {
    const normalizedTenantId = this.normalizeTenantId(tenantId);
    const source = (await this.repository.list(normalizedTenantId)).map((row) =>
      this.mapDbRow(row),
    );
    const filtered = this.filterOperationsByAggregateQuery(source, query);
    return this.buildSummary(filtered, query);
  }

  async getBreakdown(query: FinanceAggregateQuery, tenantId: string): Promise<FinanceBreakdownDto> {
    const normalizedTenantId = this.normalizeTenantId(tenantId);
    const source = (await this.repository.list(normalizedTenantId)).map((row) =>
      this.mapDbRow(row),
    );
    const filtered = this.filterOperationsByAggregateQuery(source, query);
    const totals = this.buildSummary(filtered, query);

    const byCategory = new Map<
      string,
      {
        key: string;
        label: string;
        amount: number;
        count: number;
        incomeTotal: number;
        expenseTotal: number;
      }
    >();

    for (const operation of filtered) {
      const rawCategory = typeof operation.category === 'string' ? operation.category.trim() : '';
      const key = rawCategory.length > 0 ? rawCategory : 'uncategorized';
      const current = byCategory.get(key) ?? {
        key,
        label: key,
        amount: 0,
        count: 0,
        incomeTotal: 0,
        expenseTotal: 0,
      };
      const amount = this.normalizeAmount(operation.amount);
      const type = this.normalizeType(operation.type);

      current.amount += amount;
      current.count += 1;
      if (type === 'income') {
        current.incomeTotal += amount;
      } else if (type === 'expense') {
        current.expenseTotal += amount;
      }
      byCategory.set(key, current);
    }

    const totalAmount = [...byCategory.values()].reduce((acc, entry) => acc + entry.amount, 0);
    const items: FinanceBreakdownItemDto[] = [...byCategory.values()]
      .map((entry) => ({
        key: entry.key,
        label: entry.label,
        amount: entry.amount,
        share_percent: totalAmount > 0 ? (entry.amount / totalAmount) * 100 : 0,
        count: entry.count,
        income_total: entry.incomeTotal,
        expense_total: entry.expenseTotal,
        net_total: entry.incomeTotal - entry.expenseTotal,
      }))
      .sort((left, right) => {
        if (right.amount !== left.amount) {
          return right.amount - left.amount;
        }
        return left.key.localeCompare(right.key);
      });

    const byProject = new Map<
      string,
      {
        projectId: string;
        incomeTotal: number;
        expenseTotal: number;
        operationCount: number;
        goldVolume: number;
        saleIncomeTotal: number;
      }
    >();

    for (const operation of filtered) {
      const rawProjectId =
        typeof operation.project_id === 'string' ? operation.project_id.trim().toLowerCase() : '';
      const projectId = rawProjectId.length > 0 ? rawProjectId : 'global';
      const current = byProject.get(projectId) ?? {
        projectId,
        incomeTotal: 0,
        expenseTotal: 0,
        operationCount: 0,
        goldVolume: 0,
        saleIncomeTotal: 0,
      };

      const amount = this.normalizeAmount(operation.amount);
      const type = this.normalizeType(operation.type);
      if (type === 'income') {
        current.incomeTotal += amount;
      } else if (type === 'expense') {
        current.expenseTotal += amount;
      }

      const category =
        typeof operation.category === 'string' ? operation.category.trim().toLowerCase() : '';
      const goldAmount = this.normalizeAmount(operation.gold_amount);
      if (type === 'income' && category === 'sale' && goldAmount > 0) {
        current.goldVolume += goldAmount;
        current.saleIncomeTotal += amount;
      }

      current.operationCount += 1;
      byProject.set(projectId, current);
    }

    const projectPerformanceItems: FinanceProjectPerformanceItemDto[] = [...byProject.values()]
      .map((entry) => {
        const netTotal = entry.incomeTotal - entry.expenseTotal;
        return {
          project_id: entry.projectId,
          income_total: entry.incomeTotal,
          expense_total: entry.expenseTotal,
          net_total: netTotal,
          margin_percent: entry.incomeTotal > 0 ? (netTotal / entry.incomeTotal) * 100 : 0,
          operation_count: entry.operationCount,
          gold_volume: entry.goldVolume,
          average_gold_price:
            entry.goldVolume > 0 ? (entry.saleIncomeTotal * 1000) / entry.goldVolume : 0,
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
    const source = (await this.repository.list(normalizedTenantId)).map((row) =>
      this.mapDbRow(row),
    );
    const filtered = this.filterOperationsByAggregateQuery(source, query);
    return {
      granularity: this.normalizeGranularity(query.granularity),
      points: this.buildTimeSeriesPoints(filtered, query),
      totals: this.buildSummary(filtered, query),
    };
  }
}
