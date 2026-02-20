import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { ResourcesRepository } from './resources.repository';

type ResourceKind = 'licenses' | 'proxies' | 'subscriptions';
type ResourceRecord = Record<string, unknown>;

export interface ResourceListQuery {
  page?: number | undefined;
  limit?: number | undefined;
  sort?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
  q?: string | undefined;
}

export interface ResourceListResult {
  items: ResourceRecord[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class ResourcesService {
  constructor(private readonly repository: ResourcesRepository) {}

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

  private makeId(kind: ResourceKind): string {
    const stamp = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 8);
    return `${kind}-${stamp}-${random}`;
  }

  private applyListQuery(items: ResourceRecord[], query: ResourceListQuery): ResourceListResult {
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

  private mapDbRowToRecord(row: Record<string, unknown>): ResourceRecord {
    const id = String(row.id || '').trim();
    const payload = row.payload;
    if (payload && typeof payload === 'object') {
      return { ...(payload as ResourceRecord), ...(id ? { id } : {}) };
    }
    return id ? { id } : {};
  }

  async list(
    kind: ResourceKind,
    query: ResourceListQuery,
    tenantId: string,
  ): Promise<ResourceListResult> {
    const rows = await this.repository.list(tenantId, kind);
    const mapped = rows.map((row) => this.mapDbRowToRecord(row));
    return this.applyListQuery(mapped, query);
  }

  async getById(kind: ResourceKind, id: string, tenantId: string): Promise<ResourceRecord | null> {
    const row = await this.repository.findById(tenantId, kind, id);
    if (!row) {
      return null;
    }
    return this.mapDbRowToRecord(row);
  }

  async create(
    kind: ResourceKind,
    payload: ResourceRecord,
    explicitId: string | undefined,
    tenantId: string,
  ): Promise<ResourceRecord> {
    const rawId = typeof explicitId === 'string' ? explicitId.trim() : '';
    const payloadId = typeof payload.id === 'string' ? payload.id.trim() : '';
    const id = rawId || payloadId || this.makeId(kind);

    const nextRecord = {
      ...payload,
      id,
      created_at: payload.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const row = await this.repository.upsert({
      tenantId,
      kind,
      id,
      payload: nextRecord as Prisma.InputJsonValue,
    });
    return this.mapDbRowToRecord(row);
  }

  async update(
    kind: ResourceKind,
    id: string,
    payload: ResourceRecord,
    tenantId: string,
  ): Promise<ResourceRecord | null> {
    const dbCurrent = await this.repository.findById(tenantId, kind, id);
    const current = dbCurrent ? this.mapDbRowToRecord(dbCurrent) : null;
    if (!current) {
      return null;
    }

    const nextRecord = {
      ...current,
      ...payload,
      id,
      updated_at: new Date().toISOString(),
    };

    const row = await this.repository.upsert({
      tenantId,
      kind,
      id,
      payload: nextRecord as Prisma.InputJsonValue,
    });
    return this.mapDbRowToRecord(row);
  }

  async remove(kind: ResourceKind, id: string, tenantId: string): Promise<boolean> {
    return this.repository.delete(tenantId, kind, id);
  }
}
