import { Injectable } from '@nestjs/common';

type BotRecord = Record<string, unknown>;
type BotStatus = 'offline' | 'prepare' | 'leveling' | 'profession' | 'farming' | 'banned';
type BotLifecycleStage = 'prepare' | 'leveling' | 'profession' | 'farming' | 'banned';

interface BotLifecycleTransition {
  from: 'prepare' | 'leveling' | 'profession' | 'farming' | 'create';
  to: 'prepare' | 'leveling' | 'profession' | 'farming';
  timestamp: number;
}

interface BotLifecycleState {
  current_stage: BotLifecycleStage;
  previous_status?: BotStatus;
  stage_transitions: BotLifecycleTransition[];
  ban_details?: Record<string, unknown>;
}

export interface BotsListQuery {
  page?: number | undefined;
  limit?: number | undefined;
  sort?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
  q?: string | undefined;
}

export interface BotsListResult {
  items: BotRecord[];
  total: number;
  page: number;
  limit: number;
}

const BOT_STATUS_TO_STAGE: Record<
  string,
  'prepare' | 'leveling' | 'profession' | 'farming' | null
> = {
  offline: null,
  prepare: 'prepare',
  leveling: 'leveling',
  profession: 'profession',
  farming: 'farming',
  banned: null,
};

const RESTORABLE_STATUSES = new Set(['offline', 'prepare', 'leveling', 'profession', 'farming']);

export class BotsServiceValidationError extends Error {}

@Injectable()
export class BotsService {
  private readonly store = new Map<string, BotRecord>();

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
    return `bot-${stamp}-${random}`;
  }

  private toLifecycleStageFromStatus(
    status: unknown,
  ): 'prepare' | 'leveling' | 'profession' | 'farming' | null {
    const normalized = String(status || '')
      .trim()
      .toLowerCase();
    return BOT_STATUS_TO_STAGE[normalized] || null;
  }

  private createDefaultLifecycle(): BotLifecycleState {
    return {
      current_stage: 'prepare',
      stage_transitions: [],
    };
  }

  private toTimestampFromRussianDate(value: unknown): number {
    const parts = String(value || '')
      .trim()
      .split('.')
      .map((part) => Number(part));

    if (parts.length !== 3) return Date.now();
    const [day, month, year] = parts;
    if (!day || !month || !year) return Date.now();

    const date = new Date(year, month - 1, day);
    if (Number.isNaN(date.getTime())) {
      return Date.now();
    }

    return date.getTime();
  }

  list(query: BotsListQuery): BotsListResult {
    const order = query.order === 'desc' ? 'desc' : 'asc';
    const page = Number.isFinite(query.page) && (query.page ?? 0) > 0 ? Number(query.page) : 1;
    const limit = Number.isFinite(query.limit) && (query.limit ?? 0) > 0 ? Number(query.limit) : 50;
    const q = String(query.q || '')
      .trim()
      .toLowerCase();
    const sort = String(query.sort || '').trim();

    let data = [...this.store.values()];

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

  getById(id: string): BotRecord | null {
    return this.store.get(id) ?? null;
  }

  create(payload: BotRecord, explicitId?: string): BotRecord {
    const rawId = typeof explicitId === 'string' ? explicitId.trim() : '';
    const payloadId = typeof payload.id === 'string' ? payload.id.trim() : '';
    const id = rawId || payloadId || this.makeId();

    const nextRecord = {
      ...payload,
      id,
      created_at: payload.created_at ?? Date.now(),
      updated_at: Date.now(),
    };

    this.store.set(id, nextRecord);
    return nextRecord;
  }

  patch(id: string, payload: BotRecord): BotRecord | null {
    const current = this.store.get(id);
    if (!current) return null;

    const next = {
      ...current,
      ...payload,
      id,
      updated_at: Date.now(),
    };
    this.store.set(id, next);
    return next;
  }

  remove(id: string): boolean {
    return this.store.delete(id);
  }

  getLifecycle(id: string): BotLifecycleState | null {
    const entity = this.store.get(id);
    if (!entity) return null;
    const lifecycle = entity.lifecycle;
    if (!lifecycle || typeof lifecycle !== 'object') return null;
    return lifecycle as BotLifecycleState;
  }

  getStageTransitions(id: string): BotLifecycleTransition[] | null {
    const entity = this.store.get(id);
    if (!entity) return null;
    const transitions = (entity.lifecycle as BotLifecycleState | undefined)?.stage_transitions;
    return Array.isArray(transitions) ? transitions : [];
  }

  isBanned(id: string): boolean | null {
    const entity = this.store.get(id);
    if (!entity) return null;
    const status = String(entity.status || '').toLowerCase();
    const lifecycleStage = String(
      (entity.lifecycle as BotLifecycleState | undefined)?.current_stage || '',
    ).toLowerCase();
    return status === 'banned' || lifecycleStage === 'banned';
  }

  transition(id: string, nextStatus: BotStatus): BotRecord | null {
    if (nextStatus === 'banned') {
      throw new BotsServiceValidationError('Use /lifecycle/ban endpoint for ban transitions');
    }

    const entity = this.store.get(id);
    if (!entity) return null;

    const currentStatus = String(entity.status || 'offline') as BotStatus;
    if (currentStatus === nextStatus) {
      return entity;
    }

    const lifecycle = ((entity.lifecycle as BotLifecycleState | undefined) ||
      this.createDefaultLifecycle()) as BotLifecycleState;
    const nextStage = this.toLifecycleStageFromStatus(nextStatus) || 'prepare';
    const previousStage = this.toLifecycleStageFromStatus(currentStatus);
    const nextTransitions = Array.isArray(lifecycle.stage_transitions)
      ? [...lifecycle.stage_transitions]
      : [];

    if (previousStage) {
      nextTransitions.push({
        from: previousStage,
        to: nextStage,
        timestamp: Date.now(),
      });
    } else {
      nextTransitions.push({
        from: 'create',
        to: nextStage,
        timestamp: Date.now(),
      });
    }

    const updated = {
      ...entity,
      status: nextStatus,
      lifecycle: {
        ...lifecycle,
        current_stage: nextStage,
        previous_status: currentStatus,
        stage_transitions: nextTransitions,
      },
      updated_at: Date.now(),
    };

    this.store.set(id, updated);
    return updated;
  }

  ban(id: string, details: Record<string, unknown>): BotRecord | null {
    const entity = this.store.get(id);
    if (!entity) return null;

    const currentStatus = String(entity.status || 'offline');
    const lifecycle = ((entity.lifecycle as BotLifecycleState | undefined) ||
      this.createDefaultLifecycle()) as BotLifecycleState;
    const nextTransitions = Array.isArray(lifecycle.stage_transitions)
      ? [...lifecycle.stage_transitions]
      : [];
    const previousStage = this.toLifecycleStageFromStatus(currentStatus);
    if (previousStage) {
      nextTransitions.push({
        from: previousStage,
        to: previousStage,
        timestamp: Date.now(),
      });
    }

    const banDetails = {
      ...details,
      ban_timestamp: this.toTimestampFromRussianDate(details.ban_date),
    };

    const updated = {
      ...entity,
      status: 'banned',
      lifecycle: {
        ...lifecycle,
        current_stage: 'banned',
        previous_status: currentStatus,
        stage_transitions: nextTransitions,
        ban_details: banDetails,
      },
      updated_at: Date.now(),
    };

    this.store.set(id, updated);
    return updated;
  }

  unban(id: string): BotRecord | null {
    const entity = this.store.get(id);
    if (!entity) return null;

    const lifecycle = ((entity.lifecycle as BotLifecycleState | undefined) ||
      this.createDefaultLifecycle()) as BotLifecycleState;
    if (!lifecycle?.ban_details) {
      throw new BotsServiceValidationError('Bot is not banned');
    }

    const previousStatus = String(lifecycle.previous_status || '').toLowerCase();
    const restoredStatus = RESTORABLE_STATUSES.has(previousStatus) ? previousStatus : 'offline';
    const restoredStage = this.toLifecycleStageFromStatus(restoredStatus) || 'prepare';

    const updated = {
      ...entity,
      status: restoredStatus,
      lifecycle: {
        ...lifecycle,
        current_stage: restoredStage,
        ban_details: {
          ...lifecycle.ban_details,
          unbanned_at: Date.now(),
        },
      },
      updated_at: Date.now(),
    };

    this.store.set(id, updated);
    return updated;
  }
}
