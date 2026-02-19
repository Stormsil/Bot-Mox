import { Injectable } from '@nestjs/common';

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
  private readonly store = new Map<ResourceKind, Map<string, ResourceRecord>>([
    ['licenses', new Map()],
    ['proxies', new Map()],
    ['subscriptions', new Map()],
  ]);

  private getBucket(kind: ResourceKind): Map<string, ResourceRecord> {
    const bucket = this.store.get(kind);
    if (!bucket) {
      throw new Error(`Unknown resource bucket: ${kind}`);
    }
    return bucket;
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

  private makeId(kind: ResourceKind): string {
    const stamp = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 8);
    return `${kind}-${stamp}-${random}`;
  }

  list(kind: ResourceKind, query: ResourceListQuery): ResourceListResult {
    const order = query.order === 'desc' ? 'desc' : 'asc';
    const page = Number.isFinite(query.page) && (query.page ?? 0) > 0 ? Number(query.page) : 1;
    const limit = Number.isFinite(query.limit) && (query.limit ?? 0) > 0 ? Number(query.limit) : 50;
    const q = String(query.q || '')
      .trim()
      .toLowerCase();
    const sort = String(query.sort || '').trim();

    let data = [...this.getBucket(kind).values()];

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

  getById(kind: ResourceKind, id: string): ResourceRecord | null {
    return this.getBucket(kind).get(id) ?? null;
  }

  create(kind: ResourceKind, payload: ResourceRecord, explicitId?: string): ResourceRecord {
    const rawId = typeof explicitId === 'string' ? explicitId.trim() : '';
    const payloadId = typeof payload.id === 'string' ? payload.id.trim() : '';
    const id = rawId || payloadId || this.makeId(kind);

    const nextRecord = {
      ...payload,
      id,
      created_at: payload.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.getBucket(kind).set(id, nextRecord);
    return nextRecord;
  }

  update(kind: ResourceKind, id: string, payload: ResourceRecord): ResourceRecord | null {
    const current = this.getBucket(kind).get(id);
    if (!current) {
      return null;
    }

    const nextRecord = {
      ...current,
      ...payload,
      id,
      updated_at: new Date().toISOString(),
    };

    this.getBucket(kind).set(id, nextRecord);
    return nextRecord;
  }

  remove(kind: ResourceKind, id: string): boolean {
    return this.getBucket(kind).delete(id);
  }
}
