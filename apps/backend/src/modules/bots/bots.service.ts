import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { buildBanPayload, buildTransitionPayload, buildUnbanPayload } from './bots.lifecycle';
import { BotsRepository } from './bots.repository';
import type {
  BotLifecycleState,
  BotLifecycleTransition,
  BotRecord,
  BotStatus,
  BotsListQuery,
  BotsListResult,
} from './bots.types';
import {
  createDefaultLifecycle,
  makeId,
  mapDbRow,
  normalizeSearchValue,
  normalizeTenantId,
} from './bots.utils';

export type { BotsListQuery } from './bots.types';

export class BotsServiceValidationError extends Error {}

@Injectable()
export class BotsService {
  constructor(private readonly repository: BotsRepository) {}

  async list(query: BotsListQuery, tenantId: string): Promise<BotsListResult> {
    const normalizedTenantId = normalizeTenantId(tenantId);
    const order = query.order === 'desc' ? 'desc' : 'asc';
    const page = Number.isFinite(query.page) && (query.page ?? 0) > 0 ? Number(query.page) : 1;
    const limit = Number.isFinite(query.limit) && (query.limit ?? 0) > 0 ? Number(query.limit) : 50;
    const q = String(query.q || '')
      .trim()
      .toLowerCase();
    const sort = String(query.sort || '').trim();

    let data: BotRecord[] = [];
    const rows = await this.repository.list(normalizedTenantId);
    data = rows.map((row) => mapDbRow(row));

    if (q) {
      data = data.filter((item) =>
        Object.values(item).some((value) => normalizeSearchValue(value).includes(q)),
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

  async getById(id: string, tenantId: string): Promise<BotRecord | null> {
    const normalizedTenantId = normalizeTenantId(tenantId);
    const row = await this.repository.findById(normalizedTenantId, id);
    return row ? mapDbRow(row) : null;
  }

  async create(
    payload: BotRecord,
    explicitId: string | undefined,
    tenantId: string,
  ): Promise<BotRecord> {
    const normalizedTenantId = normalizeTenantId(tenantId);
    const rawId = typeof explicitId === 'string' ? explicitId.trim() : '';
    const payloadId = typeof payload.id === 'string' ? payload.id.trim() : '';
    const id = rawId || payloadId || makeId();

    const nextRecord = {
      ...payload,
      id,
      created_at: payload.created_at ?? Date.now(),
      updated_at: Date.now(),
    };
    const row = await this.repository.upsert({
      tenantId: normalizedTenantId,
      id,
      payload: nextRecord as Prisma.InputJsonValue,
    });
    return mapDbRow(row);
  }

  async patch(id: string, payload: BotRecord, tenantId: string): Promise<BotRecord | null> {
    const normalizedTenantId = normalizeTenantId(tenantId);
    const row = await this.repository.findById(normalizedTenantId, id);
    const current = row ? mapDbRow(row) : null;
    if (!current) return null;

    const next = {
      ...current,
      ...payload,
      id,
      updated_at: Date.now(),
    };
    const updatedRow = await this.repository.upsert({
      tenantId: normalizedTenantId,
      id,
      payload: next as Prisma.InputJsonValue,
    });
    return mapDbRow(updatedRow);
  }

  async remove(id: string, tenantId: string): Promise<boolean> {
    const normalizedTenantId = normalizeTenantId(tenantId);
    return this.repository.delete(normalizedTenantId, id);
  }

  async getLifecycle(id: string, tenantId: string): Promise<BotLifecycleState | null> {
    const entity = await this.getById(id, tenantId);
    if (!entity) return null;
    const lifecycle = entity.lifecycle;
    if (!lifecycle || typeof lifecycle !== 'object') return null;
    return lifecycle as BotLifecycleState;
  }

  async getStageTransitions(
    id: string,
    tenantId: string,
  ): Promise<BotLifecycleTransition[] | null> {
    const entity = await this.getById(id, tenantId);
    if (!entity) return null;
    const transitions = (entity.lifecycle as BotLifecycleState | undefined)?.stage_transitions;
    return Array.isArray(transitions) ? transitions : [];
  }

  async isBanned(id: string, tenantId: string): Promise<boolean | null> {
    const entity = await this.getById(id, tenantId);
    if (!entity) return null;
    const status = String(entity.status || '').toLowerCase();
    const lifecycleStage = String(
      (entity.lifecycle as BotLifecycleState | undefined)?.current_stage || '',
    ).toLowerCase();
    return status === 'banned' || lifecycleStage === 'banned';
  }

  async transition(id: string, nextStatus: BotStatus, tenantId: string): Promise<BotRecord | null> {
    const normalizedTenantId = normalizeTenantId(tenantId);
    if (nextStatus === 'banned') {
      throw new BotsServiceValidationError('Use /lifecycle/ban endpoint for ban transitions');
    }

    const entity = await this.getById(id, normalizedTenantId);
    if (!entity) return null;

    const currentStatus = String(entity.status || 'offline') as BotStatus;
    if (currentStatus === nextStatus) {
      return entity;
    }

    const updated = buildTransitionPayload(entity, nextStatus);

    const row = await this.repository.upsert({
      tenantId: normalizedTenantId,
      id,
      payload: updated as unknown as Prisma.InputJsonValue,
    });
    return mapDbRow(row);
  }

  async ban(
    id: string,
    details: Record<string, unknown>,
    tenantId: string,
  ): Promise<BotRecord | null> {
    const normalizedTenantId = normalizeTenantId(tenantId);
    const entity = await this.getById(id, normalizedTenantId);
    if (!entity) return null;

    const updated = buildBanPayload(entity, details);

    const row = await this.repository.upsert({
      tenantId: normalizedTenantId,
      id,
      payload: updated as unknown as Prisma.InputJsonValue,
    });
    return mapDbRow(row);
  }

  async unban(id: string, tenantId: string): Promise<BotRecord | null> {
    const normalizedTenantId = normalizeTenantId(tenantId);
    const entity = await this.getById(id, normalizedTenantId);
    if (!entity) return null;

    const lifecycle = ((entity.lifecycle as BotLifecycleState | undefined) ||
      createDefaultLifecycle()) as BotLifecycleState;
    if (!lifecycle?.ban_details) {
      throw new BotsServiceValidationError('Bot is not banned');
    }

    const updated = buildUnbanPayload(entity);

    const row = await this.repository.upsert({
      tenantId: normalizedTenantId,
      id,
      payload: updated as unknown as Prisma.InputJsonValue,
    });
    return mapDbRow(row);
  }
}
