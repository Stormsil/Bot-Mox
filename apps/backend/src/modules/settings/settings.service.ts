import {
  type settingsApiKeysMutationSchema,
  settingsApiKeysSchema,
  type settingsNotificationEventsMutationSchema,
  settingsNotificationEventsSchema,
  type settingsProxyMutationSchema,
  settingsProxySchema,
} from '@botmox/api-contract';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { SettingsRepository } from './settings.repository';

type SettingsApiKeys = import('zod').infer<typeof settingsApiKeysSchema>;
type SettingsApiKeysMutation = import('zod').infer<typeof settingsApiKeysMutationSchema>;
type SettingsProxy = import('zod').infer<typeof settingsProxySchema>;
type SettingsProxyMutation = import('zod').infer<typeof settingsProxyMutationSchema>;
type SettingsNotificationEvents = import('zod').infer<typeof settingsNotificationEventsSchema>;
type SettingsNotificationEventsMutation = import('zod').infer<
  typeof settingsNotificationEventsMutationSchema
>;

const SETTINGS_API_KEYS_PATH = 'settings/api_keys';
const SETTINGS_PROXY_PATH = 'settings/proxy';
const SETTINGS_NOTIFICATION_EVENTS_PATH = 'settings/notifications/events';
const SETTINGS_THEME_PATH = 'settings/theme';
const SETTINGS_PROJECTS_PATH = 'settings/projects';
const SETTINGS_ALERTS_PATH = 'settings/alerts';
const SETTINGS_STORAGE_POLICY_PATH = 'settings/storage_policy';
const SETTINGS_UI_RESOURCE_TREE_PATH = 'settings/ui/resource_tree';
const SETTINGS_VMGENERATOR_PATH = 'settings/vmgenerator';
const SETTINGS_VMGENERATOR_TASK_LOGS_PATH = 'settings/vmgenerator/task_logs';
const DEFAULT_SETTINGS_ALERTS = { warning_days: 7 };
const DEFAULT_SETTINGS_RESOURCE_TREE = {
  expandedKeys: [] as string[],
  visibleStatuses: [] as string[],
  showFilters: true,
};
const DEFAULT_SETTINGS_PROJECTS: Record<string, unknown> = {};
const DEFAULT_SETTINGS_STORAGE_POLICY: Record<string, unknown> = {};
const DEFAULT_SETTINGS_THEME: Record<string, unknown> = {};
const DEFAULT_SETTINGS_VMGENERATOR: Record<string, unknown> = {};
const DEFAULT_SETTINGS_VMGENERATOR_TASK_LOGS: unknown[] = [];
const DEFAULT_SETTINGS_API_KEYS: Record<string, unknown> = {};
const DEFAULT_SETTINGS_PROXY: Record<string, unknown> = {};
const DEFAULT_SETTINGS_NOTIFICATION_EVENTS: Record<string, unknown> = {};

type ScheduleGenerateMode = 'seeded' | 'random';

type ScheduleSession = {
  id: string;
  start: string;
  end: string;
  enabled: boolean;
  profile?: string;
  type: 'active';
};

type ScheduleDay = {
  enabled: boolean;
  sessions: ScheduleSession[];
};

type GeneratedWeekSchedule = {
  days: {
    '0': ScheduleDay;
    '1': ScheduleDay;
    '2': ScheduleDay;
    '3': ScheduleDay;
    '4': ScheduleDay;
    '5': ScheduleDay;
    '6': ScheduleDay;
  };
  allowedWindows: Array<{ start: string; end: string }>;
};

type ScheduleGenerationParams = {
  startTime: string;
  endTime: string;
  useSecondWindow?: boolean;
  startTime2?: string;
  endTime2?: string;
  targetActiveMinutes: number;
  minSessionMinutes: number;
  minBreakMinutes: number;
  randomOffsetMinutes: number;
  profile?: string;
};

type SettingsScheduleGenerateRequest = {
  seed?: number | string;
  mode?: ScheduleGenerateMode;
  params?: unknown;
};

type ScheduleValidationResult = {
  valid: boolean;
  errors: string[];
};

type GeneratedScheduleResponse = {
  seed: number | string | null;
  mode: ScheduleGenerateMode;
  days: GeneratedWeekSchedule['days'];
  allowedWindows: GeneratedWeekSchedule['allowedWindows'];
  weekSchedule: GeneratedWeekSchedule;
  items: Array<{ day: string; start: string; end: string; profile?: string }>;
  meta: {
    tenant_id: string;
    deterministic: boolean;
    generated_at_ms: number;
    validation: ScheduleValidationResult;
  };
};

export class ScheduleValidationError extends Error {
  constructor(public readonly errors: string[]) {
    super('Invalid schedule generation params');
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function lcg(seed: number): () => number {
  let value = seed % 2147483647;
  if (value <= 0) {
    value += 2147483646;
  }
  return () => {
    value = (value * 48271) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function hashSeed(seed: string | number): number {
  const source = String(seed);
  let hash = 0;
  for (let i = 0; i < source.length; i++) {
    hash = (hash * 31 + source.charCodeAt(i)) >>> 0;
  }
  return hash === 0 ? 1337 : hash;
}

@Injectable()
export class SettingsService {
  constructor(private readonly repository: SettingsRepository) {}

  private normalizeTenantId(tenantId: string): string {
    const normalized = String(tenantId || '')
      .trim()
      .toLowerCase();
    if (!normalized) {
      throw new Error('tenantId is required');
    }
    return normalized;
  }

  private clone<T>(value: T): T {
    if (value === null || value === undefined) {
      return value;
    }
    return structuredClone(value) as T;
  }

  private mapDbRowPayload(row: Record<string, unknown>): unknown {
    return this.clone(row.payload);
  }

  private readPath<T>(
    tenantId: string,
    path: string,
    schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false } },
  ): Promise<T | null> {
    const normalizedTenantId = this.normalizeTenantId(tenantId);
    return this.repository.findByPath(normalizedTenantId, path).then((row) => {
      if (!row) {
        return null;
      }
      const parsed = schema.safeParse(this.mapDbRowPayload(row));
      if (!parsed.success) {
        return null;
      }
      return parsed.data;
    });
  }

  private mergePath<T>(
    tenantId: string,
    path: string,
    payload: unknown,
    schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false } },
  ): Promise<T> {
    const normalizedTenantId = this.normalizeTenantId(tenantId);

    const computeNext = (current: unknown): unknown => {
      let next: unknown = payload;
      if (isPlainObject(current) && isPlainObject(payload)) {
        next = { ...current, ...payload };
      }
      return next;
    };

    return this.repository.findByPath(normalizedTenantId, path).then(async (existing) => {
      const current = existing ? this.mapDbRowPayload(existing) : null;
      const next = computeNext(current);
      const row = await this.repository.upsert({
        tenantId: normalizedTenantId,
        path,
        payload: this.clone(next) as Prisma.InputJsonValue,
      });
      const parsed = schema.safeParse(this.mapDbRowPayload(row));
      if (!parsed.success) {
        throw new Error(`Invalid settings payload for ${path}`);
      }
      return parsed.data;
    });
  }

  private readRawPath(tenantId: string, path: string): Promise<unknown | null> {
    const normalizedTenantId = this.normalizeTenantId(tenantId);
    return this.repository
      .findByPath(normalizedTenantId, path)
      .then((row) => (row ? this.mapDbRowPayload(row) : null));
  }

  private writeRawPath(tenantId: string, path: string, payload: unknown): Promise<unknown> {
    const normalizedTenantId = this.normalizeTenantId(tenantId);
    return this.repository
      .upsert({
        tenantId: normalizedTenantId,
        path,
        payload: this.clone(payload) as Prisma.InputJsonValue,
      })
      .then((row) => this.mapDbRowPayload(row));
  }

  private patchRawPath(tenantId: string, path: string, patch: unknown): Promise<unknown> {
    const normalizedTenantId = this.normalizeTenantId(tenantId);
    return this.repository.findByPath(normalizedTenantId, path).then(async (existing) => {
      const current = existing ? this.mapDbRowPayload(existing) : {};
      const currentObj = isPlainObject(current) ? current : {};
      const patchObj = isPlainObject(patch) ? patch : {};
      const next: Record<string, unknown> = { ...currentObj, ...patchObj };
      for (const [key, value] of Object.entries(next)) {
        if (value === null) {
          delete next[key];
        }
      }
      const row = await this.repository.upsert({
        tenantId: normalizedTenantId,
        path,
        payload: this.clone(next) as Prisma.InputJsonValue,
      });
      return this.mapDbRowPayload(row);
    });
  }

  getApiKeys(tenantId: string): Promise<SettingsApiKeys | null> {
    return this.readPath(tenantId, SETTINGS_API_KEYS_PATH, settingsApiKeysSchema).then(
      (value) => (value ?? this.clone(DEFAULT_SETTINGS_API_KEYS)) as SettingsApiKeys,
    );
  }

  updateApiKeys(payload: SettingsApiKeysMutation, tenantId: string): Promise<SettingsApiKeys> {
    return this.mergePath(tenantId, SETTINGS_API_KEYS_PATH, payload, settingsApiKeysSchema);
  }

  getProxy(tenantId: string): Promise<SettingsProxy | null> {
    return this.readPath(tenantId, SETTINGS_PROXY_PATH, settingsProxySchema).then(
      (value) => (value ?? this.clone(DEFAULT_SETTINGS_PROXY)) as SettingsProxy,
    );
  }

  updateProxy(payload: SettingsProxyMutation, tenantId: string): Promise<SettingsProxy> {
    return this.mergePath(tenantId, SETTINGS_PROXY_PATH, payload, settingsProxySchema);
  }

  getNotificationEvents(tenantId: string): Promise<SettingsNotificationEvents | null> {
    return this.readPath(
      tenantId,
      SETTINGS_NOTIFICATION_EVENTS_PATH,
      settingsNotificationEventsSchema,
    ).then(
      (value) =>
        (value ?? this.clone(DEFAULT_SETTINGS_NOTIFICATION_EVENTS)) as SettingsNotificationEvents,
    );
  }

  updateNotificationEvents(
    payload: SettingsNotificationEventsMutation,
    tenantId: string,
  ): Promise<SettingsNotificationEvents> {
    return this.mergePath(
      tenantId,
      SETTINGS_NOTIFICATION_EVENTS_PATH,
      payload,
      settingsNotificationEventsSchema,
    );
  }

  getTheme(tenantId: string): Promise<unknown | null> {
    return this.readRawPath(tenantId, SETTINGS_THEME_PATH).then(
      (value) => value ?? DEFAULT_SETTINGS_THEME,
    );
  }

  updateTheme(payload: unknown, tenantId: string): Promise<unknown> {
    return this.writeRawPath(tenantId, SETTINGS_THEME_PATH, payload ?? {});
  }

  getProjects(tenantId: string): Promise<unknown | null> {
    return this.readRawPath(tenantId, SETTINGS_PROJECTS_PATH).then(
      (value) => value ?? DEFAULT_SETTINGS_PROJECTS,
    );
  }

  async upsertProject(projectId: string, payload: unknown, tenantId: string): Promise<unknown> {
    const normalizedProjectId = String(projectId || '').trim();
    if (!normalizedProjectId) {
      throw new Error('projectId is required');
    }
    const current = await this.readRawPath(tenantId, SETTINGS_PROJECTS_PATH);
    const nextProjects = {
      ...(isPlainObject(current) ? current : {}),
      [normalizedProjectId]: payload,
    };
    return this.writeRawPath(tenantId, SETTINGS_PROJECTS_PATH, nextProjects);
  }

  patchProjects(payload: unknown, tenantId: string): Promise<unknown> {
    return this.patchRawPath(tenantId, SETTINGS_PROJECTS_PATH, payload);
  }

  getResourceTree(tenantId: string): Promise<unknown | null> {
    return this.readRawPath(tenantId, SETTINGS_UI_RESOURCE_TREE_PATH).then(
      (value) => value ?? DEFAULT_SETTINGS_RESOURCE_TREE,
    );
  }

  updateResourceTree(payload: unknown, tenantId: string): Promise<unknown> {
    return this.writeRawPath(tenantId, SETTINGS_UI_RESOURCE_TREE_PATH, payload ?? {});
  }

  getAlerts(tenantId: string): Promise<unknown | null> {
    return this.readRawPath(tenantId, SETTINGS_ALERTS_PATH).then(
      (value) => value ?? DEFAULT_SETTINGS_ALERTS,
    );
  }

  updateAlerts(payload: unknown, tenantId: string): Promise<unknown> {
    return this.writeRawPath(tenantId, SETTINGS_ALERTS_PATH, payload ?? {});
  }

  getStoragePolicy(tenantId: string): Promise<unknown | null> {
    return this.readRawPath(tenantId, SETTINGS_STORAGE_POLICY_PATH).then(
      (value) => value ?? DEFAULT_SETTINGS_STORAGE_POLICY,
    );
  }

  updateStoragePolicy(payload: unknown, tenantId: string): Promise<unknown> {
    return this.writeRawPath(tenantId, SETTINGS_STORAGE_POLICY_PATH, payload ?? {});
  }

  getVmGenerator(tenantId: string): Promise<unknown | null> {
    return this.readRawPath(tenantId, SETTINGS_VMGENERATOR_PATH).then(
      (value) => value ?? DEFAULT_SETTINGS_VMGENERATOR,
    );
  }

  updateVmGenerator(payload: unknown, tenantId: string): Promise<unknown> {
    return this.writeRawPath(tenantId, SETTINGS_VMGENERATOR_PATH, payload ?? {});
  }

  getVmGeneratorTaskLogs(tenantId: string): Promise<unknown | null> {
    return this.readRawPath(tenantId, SETTINGS_VMGENERATOR_TASK_LOGS_PATH).then(
      (value) => value ?? DEFAULT_SETTINGS_VMGENERATOR_TASK_LOGS,
    );
  }

  updateVmGeneratorTaskLogs(payload: unknown, tenantId: string): Promise<unknown> {
    return this.writeRawPath(tenantId, SETTINGS_VMGENERATOR_TASK_LOGS_PATH, payload ?? []);
  }

  private toMinutes(time: string): number {
    const parts = time.split(':').map(Number);
    const rawHours = parts[0];
    const rawMinutes = parts[1];
    const hours = typeof rawHours === 'number' && Number.isFinite(rawHours) ? rawHours : 0;
    const minutes = typeof rawMinutes === 'number' && Number.isFinite(rawMinutes) ? rawMinutes : 0;
    return hours * 60 + minutes;
  }

  private toTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  private sortSessions(sessions: ScheduleSession[]): ScheduleSession[] {
    return [...sessions].sort((a, b) => this.toMinutes(a.start) - this.toMinutes(b.start));
  }

  private randomInt(min: number, max: number, random: () => number): number {
    return Math.floor(random() * (max - min + 1)) + min;
  }

  private generateSessionId(now: () => number, random: () => number): string {
    return `sess_${now()}_${random().toString(36).substring(2, 11)}`;
  }

  private getWindowDuration(start: string, end: string): number {
    const s = this.toMinutes(start);
    const e = this.toMinutes(end);
    return e < s ? 1440 - s + e : e - s;
  }

  private parseBoolean(value: unknown): boolean | undefined {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true') {
        return true;
      }
      if (normalized === 'false') {
        return false;
      }
    }
    return undefined;
  }

  private parseNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim().length > 0) {
      const numeric = Number(value);
      if (Number.isFinite(numeric)) {
        return numeric;
      }
    }
    return null;
  }

  private parseScheduleGenerationParams(raw: unknown): ScheduleGenerationParams {
    const params = isPlainObject(raw) ? raw : {};
    const startTime = String(params.startTime ?? '').trim();
    const endTime = String(params.endTime ?? '').trim();
    const startTime2 = String(params.startTime2 ?? '').trim();
    const endTime2 = String(params.endTime2 ?? '').trim();
    const useSecondWindow = this.parseBoolean(params.useSecondWindow) ?? false;
    const targetActiveMinutes = this.parseNumber(params.targetActiveMinutes);
    const minSessionMinutes = this.parseNumber(params.minSessionMinutes);
    const minBreakMinutes = this.parseNumber(params.minBreakMinutes);
    const randomOffsetMinutes = this.parseNumber(params.randomOffsetMinutes);
    const profileRaw = params.profile;
    const profile =
      typeof profileRaw === 'string' && profileRaw.trim().length > 0 ? profileRaw : 'farming';

    const conversionErrors: string[] = [];
    if (!startTime) {
      conversionErrors.push('startTime is required');
    }
    if (!endTime) {
      conversionErrors.push('endTime is required');
    }
    if (targetActiveMinutes === null) {
      conversionErrors.push('targetActiveMinutes must be a number');
    }
    if (minSessionMinutes === null) {
      conversionErrors.push('minSessionMinutes must be a number');
    }
    if (minBreakMinutes === null) {
      conversionErrors.push('minBreakMinutes must be a number');
    }
    if (randomOffsetMinutes === null) {
      conversionErrors.push('randomOffsetMinutes must be a number');
    }

    if (conversionErrors.length > 0) {
      throw new ScheduleValidationError(conversionErrors);
    }

    return {
      startTime,
      endTime,
      useSecondWindow,
      startTime2,
      endTime2,
      targetActiveMinutes: Number(targetActiveMinutes),
      minSessionMinutes: Number(minSessionMinutes),
      minBreakMinutes: Number(minBreakMinutes),
      randomOffsetMinutes: Number(randomOffsetMinutes),
      profile,
    };
  }

  validateScheduleGenerationParams(params: ScheduleGenerationParams): ScheduleValidationResult {
    const errors: string[] = [];

    const window1Duration = this.getWindowDuration(params.startTime, params.endTime);
    if (window1Duration <= 0) {
      errors.push('Window 1: End time must be after start time');
    }

    let totalWindowDuration = window1Duration;
    if (params.useSecondWindow && params.startTime2 && params.endTime2) {
      const window2Duration = this.getWindowDuration(params.startTime2, params.endTime2);
      if (window2Duration <= 0) {
        errors.push('Window 2: End time must be after start time');
      }

      const w1s = this.toMinutes(params.startTime);
      const w1e = this.toMinutes(params.endTime);
      const w2s = this.toMinutes(params.startTime2);
      const w2e = this.toMinutes(params.endTime2);
      const minutes = new Array(1440).fill(false);

      const fill = (s: number, e: number) => {
        let curr = s;
        while (curr !== e) {
          minutes[curr] = true;
          curr = (curr + 1) % 1440;
        }
      };
      fill(w1s, w1e);

      let overlap = false;
      let curr = w2s;
      while (curr !== w2e) {
        if (minutes[curr]) {
          overlap = true;
        }
        curr = (curr + 1) % 1440;
      }
      if (overlap) {
        errors.push('Windows must not overlap');
      }

      totalWindowDuration += window2Duration;
    }

    if (params.targetActiveMinutes < 30) {
      errors.push('Target active time must be at least 30 minutes');
    }
    if (params.targetActiveMinutes > 1380) {
      errors.push('Target active time cannot exceed 23 hours (1380 minutes)');
    }
    if (totalWindowDuration > 0 && params.targetActiveMinutes > totalWindowDuration) {
      errors.push(
        `Target active time cannot exceed total window duration (${totalWindowDuration} minutes)`,
      );
    }

    if (params.minSessionMinutes < 15) {
      errors.push('Minimum session duration must be at least 15 minutes');
    }
    if (params.minSessionMinutes > 480) {
      errors.push('Minimum session duration cannot exceed 8 hours');
    }
    if (params.minBreakMinutes < 5) {
      errors.push('Minimum break duration must be at least 5 minutes');
    }
    if (params.randomOffsetMinutes < 0) {
      errors.push('Random offset cannot be negative');
    }

    if (totalWindowDuration > 0) {
      const maxPossibleSessions = Math.max(
        1,
        Math.floor(
          (totalWindowDuration + params.minBreakMinutes) /
            (params.minSessionMinutes + params.minBreakMinutes),
        ),
      );
      const maxPossibleActiveTime =
        totalWindowDuration - (maxPossibleSessions - 1) * params.minBreakMinutes;
      if (params.targetActiveMinutes > maxPossibleActiveTime) {
        errors.push(
          `Target active time (${params.targetActiveMinutes}min) might be unreachable with current min session/break settings. ` +
            `Max possible is ~${maxPossibleActiveTime}min.`,
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private generateDaySchedule(
    params: ScheduleGenerationParams,
    random: () => number,
    now: () => number,
  ): ScheduleDay {
    const { targetActiveMinutes, minSessionMinutes, minBreakMinutes, profile = 'farming' } = params;

    const isTimeAllowed = new Array(1440).fill(false);
    const markAllowed = (start: string, end: string) => {
      let curr = this.toMinutes(start);
      const stop = this.toMinutes(end);
      if (curr === stop) {
        return;
      }
      while (curr !== stop) {
        isTimeAllowed[curr] = true;
        curr = (curr + 1) % 1440;
      }
    };

    markAllowed(params.startTime, params.endTime);
    if (params.useSecondWindow && params.startTime2 && params.endTime2) {
      markAllowed(params.startTime2, params.endTime2);
    }

    const totalAllowedMinutes = isTimeAllowed.filter((value) => value).length;
    if (totalAllowedMinutes < targetActiveMinutes) {
      return { enabled: false, sessions: [] };
    }

    let finalSessions: ScheduleSession[] = [];
    let bestActiveTime = 0;

    const sessionCountsToTry = [
      Math.max(1, Math.round(targetActiveMinutes / 180)),
      Math.max(1, Math.round(targetActiveMinutes / 120)),
      Math.max(1, Math.round(targetActiveMinutes / 240)),
    ].filter((value, index, values) => values.indexOf(value) === index);

    for (const numSessions of sessionCountsToTry) {
      for (let attempt = 0; attempt < 25; attempt++) {
        let remainingMinutes = targetActiveMinutes;
        const sessionDurations: number[] = [];
        for (let i = 0; i < numSessions; i++) {
          if (i === numSessions - 1) {
            sessionDurations.push(remainingMinutes);
          } else {
            const duration = Math.max(
              minSessionMinutes,
              Math.floor(remainingMinutes / (numSessions - i)) + this.randomInt(-40, 40, random),
            );
            const finalDuration = Math.min(
              duration,
              remainingMinutes - (numSessions - i - 1) * minSessionMinutes,
            );
            sessionDurations.push(finalDuration);
            remainingMinutes -= finalDuration;
          }
        }

        const currentSessions: ScheduleSession[] = [];
        const occupied = new Array(1440).fill(false);
        let success = true;

        const sortedDurations = [...sessionDurations].sort((a, b) => b - a);
        for (const duration of sortedDurations) {
          const possibleStarts: number[] = [];
          for (let start = 0; start < 1440; start++) {
            let canPlace = true;
            for (let minute = 0; minute < duration; minute++) {
              const point = (start + minute) % 1440;
              if (!isTimeAllowed[point] || occupied[point]) {
                canPlace = false;
                break;
              }
            }

            if (canPlace) {
              for (let breakOffset = 1; breakOffset <= minBreakMinutes; breakOffset++) {
                if (
                  occupied[(start - breakOffset + 1440) % 1440] ||
                  occupied[(start + duration + breakOffset - 1) % 1440]
                ) {
                  canPlace = false;
                  break;
                }
              }
            }

            if (canPlace) {
              possibleStarts.push(start);
            }
          }

          if (possibleStarts.length === 0) {
            success = false;
            break;
          }

          let start: number;
          if (targetActiveMinutes / totalAllowedMinutes > 0.65) {
            const edgeStart = possibleStarts[0];
            const tailStart = possibleStarts[possibleStarts.length - 1];
            if (edgeStart === undefined || tailStart === undefined) {
              success = false;
              break;
            }
            start = random() > 0.5 ? edgeStart : tailStart;
          } else {
            const randomIndex = this.randomInt(0, possibleStarts.length - 1, random);
            const randomStart = possibleStarts[randomIndex];
            if (randomStart === undefined) {
              success = false;
              break;
            }
            start = randomStart;
          }

          for (let minute = 0; minute < duration; minute++) {
            occupied[(start + minute) % 1440] = true;
          }

          currentSessions.push({
            id: this.generateSessionId(now, random),
            start: this.toTime(start),
            end: this.toTime((start + duration) % 1440),
            enabled: true,
            profile,
            type: 'active',
          });
        }

        const totalActive = currentSessions.reduce((sum, session) => {
          const start = this.toMinutes(session.start);
          const end = this.toMinutes(session.end);
          const duration = end - start;
          return sum + (duration <= 0 ? duration + 1440 : duration);
        }, 0);

        if (totalActive > bestActiveTime) {
          bestActiveTime = totalActive;
          finalSessions = currentSessions;
        }

        if (success && totalActive >= targetActiveMinutes) {
          return { enabled: true, sessions: this.sortSessions(finalSessions) };
        }
      }
    }

    return {
      enabled: finalSessions.length > 0,
      sessions: this.sortSessions(finalSessions),
    };
  }

  private generateWeekSchedule(
    params: ScheduleGenerationParams,
    random: () => number,
    now: () => number,
  ): GeneratedWeekSchedule {
    const days: GeneratedWeekSchedule['days'] = {
      '0': { enabled: true, sessions: [] },
      '1': { enabled: true, sessions: [] },
      '2': { enabled: true, sessions: [] },
      '3': { enabled: true, sessions: [] },
      '4': { enabled: true, sessions: [] },
      '5': { enabled: true, sessions: [] },
      '6': { enabled: true, sessions: [] },
    };

    for (let day = 0; day <= 6; day++) {
      const dayKey = day.toString() as keyof GeneratedWeekSchedule['days'];
      days[dayKey] = this.generateDaySchedule(params, random, now);
    }

    const allowedWindows = [{ start: params.startTime, end: params.endTime }];
    if (params.useSecondWindow && params.startTime2 && params.endTime2) {
      allowedWindows.push({ start: params.startTime2, end: params.endTime2 });
    }

    return { days, allowedWindows };
  }

  generateScheduleFromRequest(
    request: SettingsScheduleGenerateRequest,
    tenantId: string,
  ): GeneratedScheduleResponse {
    void tenantId;
    const params = this.parseScheduleGenerationParams(request.params);
    const validation = this.validateScheduleGenerationParams(params);
    if (!validation.valid) {
      throw new ScheduleValidationError(validation.errors);
    }

    const hasSeed =
      request.seed !== undefined && request.seed !== null && String(request.seed).trim().length > 0;
    const mode: ScheduleGenerateMode = hasSeed ? 'seeded' : 'random';
    const resolvedSeed = hasSeed ? (request.seed as number | string) : null;

    const random = hasSeed ? lcg(hashSeed(resolvedSeed as number | string)) : Math.random;
    const generatedAt = hasSeed
      ? 1_700_000_000_000 + hashSeed(resolvedSeed as number | string)
      : Date.now();
    const now = hasSeed ? () => generatedAt : () => Date.now();

    const weekSchedule = this.generateWeekSchedule(params, random, now);
    const items = Object.entries(weekSchedule.days).flatMap(([day, daySchedule]) =>
      daySchedule.sessions.map((session) => ({
        day,
        start: session.start,
        end: session.end,
        ...(session.profile ? { profile: session.profile } : {}),
      })),
    );

    return {
      seed: resolvedSeed,
      mode,
      days: weekSchedule.days,
      allowedWindows: weekSchedule.allowedWindows,
      weekSchedule,
      items,
      meta: {
        tenant_id: tenantId,
        deterministic: hasSeed,
        generated_at_ms: generatedAt,
        validation,
      },
    };
  }
}
