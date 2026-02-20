import type { BotLifecycleStage, BotLifecycleState, BotRecord } from './bots.types';
import { BOT_STATUS_TO_STAGE } from './bots.types';

export function normalizeTenantId(tenantId: string): string {
  const normalized = String(tenantId || '')
    .trim()
    .toLowerCase();
  if (!normalized) {
    throw new Error('tenantId is required');
  }
  return normalized;
}

export function normalizeSearchValue(value: unknown): string {
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

export function makeId(): string {
  const stamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `bot-${stamp}-${random}`;
}

export function mapDbRow(row: Record<string, unknown>): BotRecord {
  const id = String(row.id || '').trim();
  const payload = row.payload;
  if (payload && typeof payload === 'object') {
    return { ...(payload as BotRecord), ...(id ? { id } : {}) };
  }
  return id ? { id } : {};
}

export function toLifecycleStageFromStatus(
  status: unknown,
): 'prepare' | 'leveling' | 'profession' | 'farming' | null {
  const normalized = String(status || '')
    .trim()
    .toLowerCase();
  return BOT_STATUS_TO_STAGE[normalized] || null;
}

export function createDefaultLifecycle(): BotLifecycleState {
  return {
    current_stage: 'prepare',
    stage_transitions: [],
  };
}

export function toTimestampFromRussianDate(value: unknown): number {
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

export function resolveLifecycle(entity: BotRecord): BotLifecycleState {
  return ((entity.lifecycle as BotLifecycleState | undefined) ||
    createDefaultLifecycle()) as BotLifecycleState;
}

export function resolveCurrentStageFromStatus(status: string): BotLifecycleStage | null {
  return toLifecycleStageFromStatus(status);
}
