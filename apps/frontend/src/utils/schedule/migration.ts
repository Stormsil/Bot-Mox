import { generateSessionId } from './core';
import type { BotScheduleV2, ScheduleDay, ScheduleSession } from './types';
import { DEFAULT_TIMEZONE, type LegacyScheduleSlot, type UnknownRecord } from './types';

export function createEmptySchedule(): BotScheduleV2 {
  const emptyDay = (): ScheduleDay => ({
    enabled: false,
    sessions: [],
  });

  return {
    version: 2,
    timezone: DEFAULT_TIMEZONE,
    days: {
      '0': emptyDay(),
      '1': emptyDay(),
      '2': emptyDay(),
      '3': emptyDay(),
      '4': emptyDay(),
      '5': emptyDay(),
      '6': emptyDay(),
    },
    updated_at: Date.now(),
  };
}

export function createDefaultSchedule(): BotScheduleV2 {
  const workSession: ScheduleSession = {
    id: generateSessionId(),
    start: '09:00',
    end: '17:00',
    enabled: true,
    profile: 'farming',
    type: 'active',
  };

  const workDay = (): ScheduleDay => ({
    enabled: true,
    sessions: [{ ...workSession, id: generateSessionId() }],
  });

  return {
    version: 2,
    timezone: DEFAULT_TIMEZONE,
    days: {
      '0': workDay(),
      '1': workDay(),
      '2': workDay(),
      '3': workDay(),
      '4': workDay(),
      '5': workDay(),
      '6': workDay(),
    },
    updated_at: Date.now(),
  };
}

export function migrateSchedule(oldSchedule: UnknownRecord | null): BotScheduleV2 {
  if (!oldSchedule) {
    return createDefaultSchedule();
  }

  if (oldSchedule.version === 2 && typeof oldSchedule.days === 'object' && oldSchedule.days) {
    const schedule = oldSchedule as unknown as BotScheduleV2;
    for (let day = 0; day <= 6; day++) {
      const dayKey = day.toString() as keyof typeof schedule.days;
      const dayData = schedule.days[dayKey];
      if (!dayData.sessions || !Array.isArray(dayData.sessions)) {
        dayData.sessions = [];
      }
    }
    return schedule;
  }

  const newSchedule = createEmptySchedule();

  for (let day = 0; day <= 6; day++) {
    const dayKey = day.toString();
    const oldDay = oldSchedule[dayKey];

    if (oldDay && Array.isArray(oldDay) && oldDay.length > 0) {
      const sessions: ScheduleSession[] = [];
      for (const slot of oldDay) {
        if (slot && typeof slot === 'object') {
          const slotRecord = slot as LegacyScheduleSlot;
          sessions.push({
            id: generateSessionId(),
            start: slotRecord.start || '09:00',
            end: slotRecord.end || '17:00',
            enabled: slotRecord.enabled ?? false,
            profile: slotRecord.profile || 'farming',
            type: 'active',
          });
        }
      }

      const hasEnabledSession = sessions.some((s) => s.enabled);
      newSchedule.days[dayKey as keyof typeof newSchedule.days] = {
        enabled: hasEnabledSession,
        sessions,
      };
    }
  }

  newSchedule.updated_at = Date.now();
  return newSchedule;
}
