import { Injectable } from '@nestjs/common';

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

@Injectable()
export class FinanceService {
  private readonly operations = new Map<string, FinanceOperationRecord>();

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

  list(query: FinanceListQuery): FinanceListResult {
    const order = query.order === 'desc' ? 'desc' : 'asc';
    const page = Number.isFinite(query.page) && (query.page ?? 0) > 0 ? Number(query.page) : 1;
    const limit = Number.isFinite(query.limit) && (query.limit ?? 0) > 0 ? Number(query.limit) : 50;
    const q = String(query.q || '')
      .trim()
      .toLowerCase();
    const sort = String(query.sort || '').trim();

    let data = [...this.operations.values()];

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

  getById(id: string): FinanceOperationRecord | null {
    return this.operations.get(id) ?? null;
  }

  create(payload: FinanceOperationRecord, explicitId?: string): FinanceOperationRecord {
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

    this.operations.set(id, nextRecord);
    return nextRecord;
  }

  patch(id: string, payload: FinanceOperationRecord): FinanceOperationRecord | null {
    const current = this.operations.get(id);
    if (!current) {
      return null;
    }

    const nextRecord = {
      ...current,
      ...payload,
      id,
      updated_at: Date.now(),
    };

    this.operations.set(id, nextRecord);
    return nextRecord;
  }

  remove(id: string): boolean {
    return this.operations.delete(id);
  }

  getDailyStats(): Record<string, Record<string, unknown>> {
    const stats: Record<string, Record<string, unknown>> = {};
    const activeBotsByDate = new Map<string, Set<string>>();

    for (const operation of this.operations.values()) {
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

  getGoldPriceHistory(): Record<string, { price: number }> {
    const sums = new Map<string, { total: number; count: number }>();

    for (const operation of this.operations.values()) {
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
}
