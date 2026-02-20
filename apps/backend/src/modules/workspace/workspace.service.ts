import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { WorkspaceRepository } from './workspace.repository';

export type WorkspaceKind = 'notes' | 'calendar' | 'kanban';
type WorkspaceRecord = Record<string, unknown>;

export interface WorkspaceListQuery {
  page?: number | undefined;
  limit?: number | undefined;
  sort?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
  q?: string | undefined;
}

export interface WorkspaceListResult {
  items: WorkspaceRecord[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class WorkspaceService {
  constructor(private readonly repository: WorkspaceRepository) {}

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

  private makeId(kind: WorkspaceKind): string {
    const stamp = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 8);
    return `${kind}-${stamp}-${random}`;
  }

  private applyListQuery(items: WorkspaceRecord[], query: WorkspaceListQuery): WorkspaceListResult {
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

  private mapDbRowToRecord(row: Record<string, unknown>): WorkspaceRecord {
    const id = String(row.id || '').trim();
    const payload = row.payload;
    if (payload && typeof payload === 'object') {
      return { ...(payload as WorkspaceRecord), ...(id ? { id } : {}) };
    }
    return id ? { id } : {};
  }

  async list(
    kind: WorkspaceKind,
    query: WorkspaceListQuery,
    tenantId: string,
  ): Promise<WorkspaceListResult> {
    const normalizedTenantId = this.normalizeTenantId(tenantId);
    const rows = await this.repository.list(normalizedTenantId, kind);
    const items = rows.map((row) => this.mapDbRowToRecord(row));
    return this.applyListQuery(items, query);
  }

  async getById(
    kind: WorkspaceKind,
    id: string,
    tenantId: string,
  ): Promise<WorkspaceRecord | null> {
    const normalizedTenantId = this.normalizeTenantId(tenantId);
    const row = await this.repository.findById(normalizedTenantId, kind, id);
    if (!row) {
      return null;
    }
    return this.mapDbRowToRecord(row);
  }

  async create(
    kind: WorkspaceKind,
    payload: WorkspaceRecord,
    explicitId: string | undefined,
    tenantId: string,
  ): Promise<WorkspaceRecord> {
    const normalizedTenantId = this.normalizeTenantId(tenantId);
    const rawId = typeof explicitId === 'string' ? explicitId.trim() : '';
    const payloadId = typeof payload.id === 'string' ? payload.id.trim() : '';
    const id = rawId || payloadId || this.makeId(kind);
    const now = Date.now();

    const nextRecord = {
      ...payload,
      id,
      created_at: payload.created_at ?? now,
      updated_at: now,
    };

    const row = await this.repository.upsert({
      tenantId: normalizedTenantId,
      kind,
      id,
      payload: nextRecord as Prisma.InputJsonValue,
    });
    return this.mapDbRowToRecord(row);
  }

  async update(
    kind: WorkspaceKind,
    id: string,
    payload: WorkspaceRecord,
    tenantId: string,
  ): Promise<WorkspaceRecord | null> {
    const normalizedTenantId = this.normalizeTenantId(tenantId);
    const dbCurrent = await this.repository.findById(normalizedTenantId, kind, id);
    const current = dbCurrent ? this.mapDbRowToRecord(dbCurrent) : null;

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
      kind,
      id,
      payload: nextRecord as Prisma.InputJsonValue,
    });
    return this.mapDbRowToRecord(row);
  }

  async remove(kind: WorkspaceKind, id: string, tenantId: string): Promise<boolean> {
    const normalizedTenantId = this.normalizeTenantId(tenantId);
    return await this.repository.delete(normalizedTenantId, kind, id);
  }
}
