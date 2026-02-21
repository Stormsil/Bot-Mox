import type {
  BotScheduleV2,
  DayScheduleStats,
  GeneratedSchedule,
  ScheduleDay,
  ScheduleGenerationParams,
  ScheduleSession,
  ScheduleValidationError,
} from '../../types';

export type {
  BotScheduleV2,
  DayScheduleStats,
  GeneratedSchedule,
  ScheduleDay,
  ScheduleGenerationParams,
  ScheduleSession,
  ScheduleValidationError,
};

export const DEFAULT_TIMEZONE = 'Europe/Moscow';

export type UnknownRecord = Record<string, unknown>;
export type CompatScheduleSlot = Partial<
  Pick<ScheduleSession, 'start' | 'end' | 'enabled' | 'profile'>
> &
  UnknownRecord;

/** @deprecated Use CompatScheduleSlot. */
export type DeprecatedScheduleSlot = CompatScheduleSlot;

export interface LauncherScheduleSlot {
  start: string;
  end: string;
  action: 'start' | 'stop';
  profile?: string;
}

export interface LauncherScheduleDay {
  day_of_week: number;
  enabled: boolean;
  total_active_minutes: number;
  slots: LauncherScheduleSlot[];
}

export type LauncherScheduleWeek = Record<string, LauncherScheduleDay>;

export interface LauncherSchedulePayload {
  bot_id: string;
  schedule_version: number;
  timezone: string;
  current_week: LauncherScheduleWeek;
  generated_at: number;
}
