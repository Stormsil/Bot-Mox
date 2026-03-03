import { settingsScheduleGenerateResponseSchema } from '@botmox/api-contract';
import { ApiClientError, apiPost } from '../../../shared/api/apiClient';
import { generateSessionId } from '../../../shared/lib/utils/scheduleUtils';
import type {
  GeneratedSchedule,
  ScheduleDay,
  ScheduleGenerationParams,
  ScheduleSession,
} from '../../../shared/types';

const SETTINGS_SCHEDULE_GENERATE_PATH = '/api/v1/settings/schedule/generate';

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function toDay(value: unknown): ScheduleDay {
  const day = toRecord(value);
  const rawSessions = Array.isArray(day.sessions) ? day.sessions : [];
  const sessions = rawSessions
    .map((entry): ScheduleSession | null => {
      const session = toRecord(entry);
      const start = String(session.start ?? '').trim();
      const end = String(session.end ?? '').trim();
      if (!start || !end) {
        return null;
      }

      return {
        id: String(session.id ?? '').trim() || generateSessionId(),
        start,
        end,
        enabled: session.enabled === undefined ? true : Boolean(session.enabled),
        profile: String(session.profile ?? '').trim() || undefined,
        type: session.type === 'break' ? 'break' : 'active',
      };
    })
    .filter((session): session is ScheduleSession => session !== null);

  return {
    enabled: Boolean(day.enabled),
    sessions,
  };
}

function toGeneratedSchedule(value: unknown): GeneratedSchedule {
  const body = toRecord(value);
  const weekSchedule = toRecord(body.weekSchedule);
  const rootDays = toRecord(body.days);
  const weekDays = toRecord(weekSchedule.days);
  const daysSource =
    rootDays['0'] !== undefined ||
    rootDays['1'] !== undefined ||
    rootDays['2'] !== undefined ||
    rootDays['3'] !== undefined ||
    rootDays['4'] !== undefined ||
    rootDays['5'] !== undefined ||
    rootDays['6'] !== undefined
      ? rootDays
      : weekDays;

  return {
    days: {
      '0': toDay(daysSource['0']),
      '1': toDay(daysSource['1']),
      '2': toDay(daysSource['2']),
      '3': toDay(daysSource['3']),
      '4': toDay(daysSource['4']),
      '5': toDay(daysSource['5']),
      '6': toDay(daysSource['6']),
    },
  };
}

function toAllowedWindows(value: unknown): Array<{ start: string; end: string }> | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const windows = value
    .map((item) => {
      const record = toRecord(item);
      const start = String(record.start ?? '').trim();
      const end = String(record.end ?? '').trim();
      if (!start || !end) {
        return null;
      }

      return { start, end };
    })
    .filter((item): item is { start: string; end: string } => item !== null);

  return windows.length > 0 ? windows : undefined;
}

export interface ScheduleGenerationResult {
  generated: GeneratedSchedule;
  allowedWindows?: Array<{ start: string; end: string }>;
}

export async function generateScheduleViaBackend(
  params: ScheduleGenerationParams,
): Promise<ScheduleGenerationResult> {
  const response = await apiPost<unknown>(SETTINGS_SCHEDULE_GENERATE_PATH, { params });
  const payload = settingsScheduleGenerateResponseSchema.parse(response.data);
  const generated = toGeneratedSchedule(payload);

  return {
    generated,
    allowedWindows: toAllowedWindows(toRecord(payload).allowedWindows),
  };
}

export function extractScheduleGenerationErrors(error: unknown): string[] {
  if (error instanceof ApiClientError) {
    const details = toRecord(error.details);
    const nested = toRecord(details.details);
    const candidate = [details.errors, nested.errors].find((value) => Array.isArray(value));
    if (Array.isArray(candidate)) {
      const errors = candidate.map((value) => String(value ?? '').trim()).filter(Boolean);
      if (errors.length > 0) {
        return errors;
      }
    }

    const message = String(error.message || '').trim();
    if (message) {
      return [message];
    }
  }

  if (error instanceof Error) {
    const message = String(error.message || '').trim();
    if (message) {
      return [message];
    }
  }

  return ['Failed to generate schedule'];
}
