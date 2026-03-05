import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { softFailMissingStorage, softFailMissingStorageRead } from '../common/prisma-soft-fail';
import { PrismaService } from '../db/prisma.service';

export interface FinanceAggregateFilters {
  fromTs?: number;
  toTs?: number;
  currency?: string;
  projectId?: string;
  botId?: string;
}

export interface FinanceSummaryAggregateRow {
  incomeTotal: unknown;
  expenseTotal: unknown;
  operationCount: unknown;
  totalGoldSold: unknown;
  totalGoldFarmed: unknown;
  saleIncomeTotal: unknown;
}

export interface FinanceCategoryAggregateRow {
  key: string;
  label: string;
  amount: unknown;
  count: unknown;
  incomeTotal: unknown;
  expenseTotal: unknown;
}

export interface FinanceProjectAggregateRow {
  projectId: string;
  incomeTotal: unknown;
  expenseTotal: unknown;
  operationCount: unknown;
  goldVolume: unknown;
  saleIncomeTotal: unknown;
}

export interface FinanceTimeSeriesAggregateRow {
  bucketTs: unknown;
  incomeTotal: unknown;
  expenseTotal: unknown;
  operationCount: unknown;
}

export interface FinanceDailyStatsAggregateRow {
  bucketTs: unknown;
  incomeTotal: unknown;
  expenseTotal: unknown;
  activeBots: unknown;
}

export interface FinanceGoldPriceHistoryAggregateRow {
  bucketTs: unknown;
  avgGoldPrice: unknown;
}

export type FinanceTimeSeriesGranularity = 'hour' | 'day' | 'week' | 'month';

@Injectable()
export class FinanceRepository {
  private readonly prisma: PrismaService;

  constructor(prisma: PrismaService) {
    this.prisma = prisma;
  }

  private toObjectRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return {};
  }

  private normalizeOptionalString(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private normalizeOptionalNumber(value: unknown): number | undefined {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : undefined;
  }

  private normalizeAggregateFilter(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalized = value.trim().toLowerCase();
    return normalized.length > 0 ? normalized : undefined;
  }

  private normalizeAggregateTimestamp(value: unknown): number | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }

    const asNumber = Number(value);
    if (!Number.isFinite(asNumber)) {
      return undefined;
    }

    return Math.trunc(asNumber);
  }

  private normalizeAggregateFilters(filters: FinanceAggregateFilters): {
    fromTs?: number;
    toTs?: number;
    currency?: string;
    projectId?: string;
    botId?: string;
  } {
    const fromTs = this.normalizeAggregateTimestamp(filters.fromTs);
    const toTs = this.normalizeAggregateTimestamp(filters.toTs);
    const currency = this.normalizeAggregateFilter(filters.currency);
    const projectId = this.normalizeAggregateFilter(filters.projectId);
    const botId = this.normalizeAggregateFilter(filters.botId);

    return {
      ...(fromTs !== undefined ? { fromTs } : {}),
      ...(toTs !== undefined ? { toTs } : {}),
      ...(currency !== undefined ? { currency } : {}),
      ...(projectId !== undefined ? { projectId } : {}),
      ...(botId !== undefined ? { botId } : {}),
    };
  }

  private buildAggregateWhereSql(tenantId: string, filters: FinanceAggregateFilters): Prisma.Sql {
    const normalized = this.normalizeAggregateFilters(filters);
    const clauses: Prisma.Sql[] = [Prisma.sql`tenant_id = ${tenantId}`];

    if (normalized.fromTs !== undefined) {
      clauses.push(
        Prisma.sql`coalesce(operation_at, created_at) >= to_timestamp(${normalized.fromTs}::double precision / 1000.0)`,
      );
    }

    if (normalized.toTs !== undefined) {
      clauses.push(
        Prisma.sql`coalesce(operation_at, created_at) <= to_timestamp(${normalized.toTs}::double precision / 1000.0)`,
      );
    }

    if (normalized.currency !== undefined) {
      clauses.push(Prisma.sql`lower(btrim(coalesce(currency, ''))) = ${normalized.currency}`);
    }

    if (normalized.projectId !== undefined) {
      clauses.push(Prisma.sql`lower(btrim(coalesce(project_id, ''))) = ${normalized.projectId}`);
    }

    if (normalized.botId !== undefined) {
      clauses.push(Prisma.sql`lower(btrim(coalesce(bot_id, ''))) = ${normalized.botId}`);
    }

    return Prisma.sql`where ${Prisma.join(clauses, ' and ')}`;
  }

  private normalizeTimestampMs(value: unknown): number | undefined {
    if (value instanceof Date) {
      const ms = value.getTime();
      return Number.isFinite(ms) ? ms : undefined;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.abs(value) >= 100000000000 ? value : value * 1000;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return undefined;
      }

      const numeric = Number(trimmed);
      if (Number.isFinite(numeric)) {
        return Math.abs(numeric) >= 100000000000 ? numeric : numeric * 1000;
      }

      const parsed = Date.parse(trimmed);
      return Number.isFinite(parsed) ? parsed : undefined;
    }

    return undefined;
  }

  private toIsoTimestamp(value: unknown): string | null {
    const ms = this.normalizeTimestampMs(value);
    if (ms === undefined) {
      return null;
    }
    const date = new Date(ms);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }

  private buildPayloadFromTypedRow(row: Record<string, unknown>): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      id: row.id,
    };

    const type = this.normalizeOptionalString(row.type);
    const category = this.normalizeOptionalString(row.category);
    const amount = this.normalizeOptionalNumber(row.amount);
    const currency = this.normalizeOptionalString(row.currency);
    const status = this.normalizeOptionalString(row.status);
    const projectId = this.normalizeOptionalString(row.projectId);
    const botId = this.normalizeOptionalString(row.botId);
    const goldAmount = this.normalizeOptionalNumber(row.goldAmount);
    const goldPriceAtTime = this.normalizeOptionalNumber(row.goldPriceAtTime);
    const operationAtMs =
      this.normalizeTimestampMs(row.operationAt) ??
      this.normalizeTimestampMs(payload.operation_at) ??
      this.normalizeTimestampMs(payload.date);

    if (type !== undefined) payload.type = type;
    if (category !== undefined) payload.category = category;
    if (amount !== undefined) payload.amount = amount;
    if (currency !== undefined) payload.currency = currency;
    if (status !== undefined) payload.status = status;
    if (projectId !== undefined) payload.project_id = projectId;
    if (botId !== undefined) payload.bot_id = botId;
    if (goldAmount !== undefined) payload.gold_amount = goldAmount;
    if (goldPriceAtTime !== undefined) payload.gold_price_at_time = goldPriceAtTime;
    if (operationAtMs !== undefined) {
      payload.operation_at = operationAtMs;
      payload.date = operationAtMs;
    }

    if (row.createdAt instanceof Date) {
      payload.created_at = row.createdAt.getTime();
    }
    if (row.updatedAt instanceof Date) {
      payload.updated_at = row.updatedAt.getTime();
    }

    return payload;
  }

  private extractTypedFields(payloadValue: Prisma.InputJsonValue): {
    type: string | null;
    category: string | null;
    amount: number | null;
    currency: string | null;
    operationAt: string | null;
    status: string | null;
    projectId: string | null;
    botId: string | null;
    goldAmount: number | null;
    goldPriceAtTime: number | null;
  } {
    const payload = this.toObjectRecord(payloadValue);
    return {
      type: this.normalizeOptionalString(payload.type) ?? null,
      category: this.normalizeOptionalString(payload.category) ?? null,
      amount: this.normalizeOptionalNumber(payload.amount) ?? null,
      currency: this.normalizeOptionalString(payload.currency) ?? null,
      operationAt: this.toIsoTimestamp(payload.operation_at ?? payload.date),
      status: this.normalizeOptionalString(payload.status) ?? null,
      projectId: this.normalizeOptionalString(payload.project_id) ?? null,
      botId: this.normalizeOptionalString(payload.bot_id) ?? null,
      goldAmount: this.normalizeOptionalNumber(payload.gold_amount) ?? null,
      goldPriceAtTime: this.normalizeOptionalNumber(payload.gold_price_at_time) ?? null,
    };
  }

  private asTypedRows(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
    return rows.map((row) => ({
      id: row.id,
      payload: this.buildPayloadFromTypedRow(row),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  private async listTyped(tenantId: string): Promise<Array<Record<string, unknown>>> {
    const rows = await softFailMissingStorageRead(
      () =>
        this.prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
          select
            id,
            type,
            category,
            amount,
            currency,
            operation_at as "operationAt",
            status,
            project_id as "projectId",
            bot_id as "botId",
            gold_amount as "goldAmount",
            gold_price_at_time as "goldPriceAtTime",
            created_at as "createdAt",
            updated_at as "updatedAt"
          from public.finance_operations
          where tenant_id = ${tenantId}
          order by updated_at desc
        `),
      [],
    );
    return this.asTypedRows(rows);
  }

  private async findByIdTyped(
    tenantId: string,
    id: string,
  ): Promise<Record<string, unknown> | null> {
    const rows = await softFailMissingStorageRead(
      () =>
        this.prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
          select
            id,
            type,
            category,
            amount,
            currency,
            operation_at as "operationAt",
            status,
            project_id as "projectId",
            bot_id as "botId",
            gold_amount as "goldAmount",
            gold_price_at_time as "goldPriceAtTime",
            created_at as "createdAt",
            updated_at as "updatedAt"
          from public.finance_operations
          where tenant_id = ${tenantId}
            and id = ${id}
          limit 1
        `),
      [],
    );
    return rows[0] ? (this.asTypedRows(rows)[0] ?? null) : null;
  }

  private async upsertTyped(
    input: {
      tenantId: string;
      id: string;
      payload: Prisma.InputJsonValue;
    },
    fallback: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const typed = this.extractTypedFields(input.payload);
    const operation = async () => {
      const rows = await this.prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
          insert into public.finance_operations (
            tenant_id,
            id,
            type,
            category,
            amount,
            currency,
            operation_at,
            status,
            project_id,
            bot_id,
            gold_amount,
            gold_price_at_time,
            created_at,
            updated_at
          ) values (
            ${input.tenantId},
            ${input.id},
            ${typed.type},
            ${typed.category},
            ${typed.amount},
            ${typed.currency},
            ${typed.operationAt}::timestamptz,
            ${typed.status},
            ${typed.projectId},
            ${typed.botId},
            ${typed.goldAmount},
            ${typed.goldPriceAtTime},
            now(),
            now()
          )
          on conflict (tenant_id, id)
          do update set
            type = excluded.type,
            category = excluded.category,
            amount = excluded.amount,
            currency = excluded.currency,
            operation_at = excluded.operation_at,
            status = excluded.status,
            project_id = excluded.project_id,
            bot_id = excluded.bot_id,
            gold_amount = excluded.gold_amount,
            gold_price_at_time = excluded.gold_price_at_time,
            updated_at = now()
          returning
            id,
            type,
            category,
            amount,
            currency,
            operation_at as "operationAt",
            status,
            project_id as "projectId",
            bot_id as "botId",
            gold_amount as "goldAmount",
            gold_price_at_time as "goldPriceAtTime",
            created_at as "createdAt",
            updated_at as "updatedAt"
        `);
      const mapped = this.asTypedRows(rows);
      return mapped[0] ?? fallback;
    };
    return operation();
  }

  private async deleteTyped(tenantId: string, id: string): Promise<boolean> {
    const operation = () =>
      this.prisma.$executeRaw<number>(Prisma.sql`
        delete from public.finance_operations
        where tenant_id = ${tenantId}
          and id = ${id}
      `);
    const count = await operation();
    return count > 0;
  }

  async list(tenantId: string): Promise<Array<Record<string, unknown>>> {
    return this.listTyped(tenantId);
  }

  async findById(tenantId: string, id: string): Promise<Record<string, unknown> | null> {
    return this.findByIdTyped(tenantId, id);
  }

  async upsert(input: {
    tenantId: string;
    id: string;
    payload: Prisma.InputJsonValue;
  }): Promise<Record<string, unknown>> {
    return this.upsertTyped(input, {
      id: input.id,
      payload: input.payload,
    });
  }

  async delete(tenantId: string, id: string): Promise<boolean> {
    return this.deleteTyped(tenantId, id);
  }

  async getSummaryAggregate(
    tenantId: string,
    filters: FinanceAggregateFilters,
  ): Promise<FinanceSummaryAggregateRow> {
    const whereSql = this.buildAggregateWhereSql(tenantId, filters);
    const rows = await softFailMissingStorageRead(
      () =>
        this.prisma.$queryRaw<Array<FinanceSummaryAggregateRow>>(Prisma.sql`
          select
            coalesce(sum(case when type = 'income' then amount else 0 end), 0) as "incomeTotal",
            coalesce(sum(case when type = 'expense' then amount else 0 end), 0) as "expenseTotal",
            count(*) as "operationCount",
            coalesce(sum(case when type = 'income' and lower(btrim(coalesce(category, ''))) = 'sale' and coalesce(gold_amount, 0) > 0 then gold_amount else 0 end), 0) as "totalGoldSold",
            coalesce(sum(case when type = 'income' and coalesce(gold_amount, 0) > 0 then gold_amount else 0 end), 0) as "totalGoldFarmed",
            coalesce(sum(case when type = 'income' and lower(btrim(coalesce(category, ''))) = 'sale' and coalesce(gold_amount, 0) > 0 then amount else 0 end), 0) as "saleIncomeTotal"
          from public.finance_operations
          ${whereSql}
        `),
      [],
    );

    return (
      rows[0] ?? {
        incomeTotal: 0,
        expenseTotal: 0,
        operationCount: 0,
        totalGoldSold: 0,
        totalGoldFarmed: 0,
        saleIncomeTotal: 0,
      }
    );
  }

  async getCategoryBreakdownAggregate(
    tenantId: string,
    filters: FinanceAggregateFilters,
  ): Promise<FinanceCategoryAggregateRow[]> {
    const whereSql = this.buildAggregateWhereSql(tenantId, filters);
    return softFailMissingStorageRead(
      () =>
        this.prisma.$queryRaw<Array<FinanceCategoryAggregateRow>>(Prisma.sql`
          select
            case when btrim(coalesce(category, '')) = '' then 'uncategorized' else btrim(category) end as key,
            case when btrim(coalesce(category, '')) = '' then 'uncategorized' else btrim(category) end as label,
            coalesce(sum(amount), 0) as "amount",
            count(*) as "count",
            coalesce(sum(case when type = 'income' then amount else 0 end), 0) as "incomeTotal",
            coalesce(sum(case when type = 'expense' then amount else 0 end), 0) as "expenseTotal"
          from public.finance_operations
          ${whereSql}
          group by 1, 2
          order by 3 desc, 1 asc
        `),
      [],
    );
  }

  async getProjectPerformanceAggregate(
    tenantId: string,
    filters: FinanceAggregateFilters,
  ): Promise<FinanceProjectAggregateRow[]> {
    const whereSql = this.buildAggregateWhereSql(tenantId, filters);
    return softFailMissingStorageRead(
      () =>
        this.prisma.$queryRaw<Array<FinanceProjectAggregateRow>>(Prisma.sql`
          select
            case when btrim(coalesce(project_id, '')) = '' then 'global' else lower(btrim(project_id)) end as "projectId",
            coalesce(sum(case when type = 'income' then amount else 0 end), 0) as "incomeTotal",
            coalesce(sum(case when type = 'expense' then amount else 0 end), 0) as "expenseTotal",
            count(*) as "operationCount",
            coalesce(sum(case when type = 'income' and lower(btrim(coalesce(category, ''))) = 'sale' and coalesce(gold_amount, 0) > 0 then gold_amount else 0 end), 0) as "goldVolume",
            coalesce(sum(case when type = 'income' and lower(btrim(coalesce(category, ''))) = 'sale' and coalesce(gold_amount, 0) > 0 then amount else 0 end), 0) as "saleIncomeTotal"
          from public.finance_operations
          ${whereSql}
          group by 1
        `),
      [],
    );
  }

  async getTimeSeriesAggregate(
    tenantId: string,
    filters: FinanceAggregateFilters,
    granularity: FinanceTimeSeriesGranularity,
  ): Promise<FinanceTimeSeriesAggregateRow[]> {
    const whereSql = this.buildAggregateWhereSql(tenantId, filters);
    const bucketExpr =
      granularity === 'hour'
        ? Prisma.sql`date_trunc('hour', coalesce(operation_at, created_at))`
        : granularity === 'day'
          ? Prisma.sql`date_trunc('day', coalesce(operation_at, created_at))`
          : granularity === 'week'
            ? Prisma.sql`date_trunc('week', coalesce(operation_at, created_at))`
            : Prisma.sql`date_trunc('month', coalesce(operation_at, created_at))`;

    return softFailMissingStorageRead(
      () =>
        this.prisma.$queryRaw<Array<FinanceTimeSeriesAggregateRow>>(Prisma.sql`
          select
            (extract(epoch from ${bucketExpr}) * 1000)::bigint as "bucketTs",
            coalesce(sum(case when type = 'income' then amount else 0 end), 0) as "incomeTotal",
            coalesce(sum(case when type = 'expense' then amount else 0 end), 0) as "expenseTotal",
            count(*) as "operationCount"
          from public.finance_operations
          ${whereSql}
          group by 1
          order by 1 asc
        `),
      [],
    );
  }

  async getDailyStatsAggregate(tenantId: string): Promise<FinanceDailyStatsAggregateRow[]> {
    return softFailMissingStorageRead(
      () =>
        this.prisma.$queryRaw<Array<FinanceDailyStatsAggregateRow>>(Prisma.sql`
          select
            (extract(epoch from date_trunc('day', coalesce(operation_at, created_at))) * 1000)::bigint as "bucketTs",
            coalesce(sum(case when type = 'income' then amount else 0 end), 0) as "incomeTotal",
            coalesce(sum(case when type = 'expense' then amount else 0 end), 0) as "expenseTotal",
            count(distinct nullif(btrim(coalesce(bot_id, '')), '')) as "activeBots"
          from public.finance_operations
          where tenant_id = ${tenantId}
          group by 1
          order by 1 asc
        `),
      [],
    );
  }

  async getGoldPriceHistoryAggregate(
    tenantId: string,
  ): Promise<FinanceGoldPriceHistoryAggregateRow[]> {
    return softFailMissingStorageRead(
      () =>
        this.prisma.$queryRaw<Array<FinanceGoldPriceHistoryAggregateRow>>(Prisma.sql`
          select
            (extract(epoch from date_trunc('day', coalesce(operation_at, created_at))) * 1000)::bigint as "bucketTs",
            avg(gold_price_at_time) as "avgGoldPrice"
          from public.finance_operations
          where tenant_id = ${tenantId}
            and type = 'income'
            and lower(btrim(coalesce(category, ''))) = 'sale'
            and gold_price_at_time is not null
            and gold_price_at_time > 0
          group by 1
          order by 1 asc
        `),
      [],
    );
  }
}
