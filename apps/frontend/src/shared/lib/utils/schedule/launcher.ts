import { calculateDayStats, minutesToTime, sortSessions, timeToMinutes } from './core';
import { getWeekDates } from './date';
import type {
  BotScheduleV2,
  LauncherSchedulePayload,
  LauncherScheduleSlot,
  LauncherScheduleWeek,
} from './types';

export function generateScheduleForLauncher(
  schedule: BotScheduleV2,
  botId: string,
): LauncherSchedulePayload {
  const weekDates = getWeekDates();
  const currentWeek: LauncherScheduleWeek = {};

  weekDates.forEach((date, index) => {
    const dayKey = index.toString() as keyof typeof schedule.days;
    const daySchedule = schedule.days[dayKey];
    const dateStr = date.toISOString().split('T')[0];

    const sortedSessions = sortSessions(daySchedule.sessions.filter((s) => s.enabled));
    const slots: LauncherScheduleSlot[] = [];

    let lastEndMinutes = 0;
    sortedSessions.forEach((session) => {
      const startMin = timeToMinutes(session.start);
      const endMin = timeToMinutes(session.end);

      if (startMin > lastEndMinutes && lastEndMinutes > 0) {
        slots.push({
          start: minutesToTime(lastEndMinutes),
          end: session.start,
          action: 'stop',
          profile: undefined,
        });
      }

      slots.push({
        start: session.start,
        end: session.end,
        action: 'start',
        profile: session.profile,
      });

      lastEndMinutes = endMin;
    });

    if (lastEndMinutes > 0 && lastEndMinutes < 1440) {
      slots.push({
        start: minutesToTime(lastEndMinutes),
        end: '23:59',
        action: 'stop',
        profile: undefined,
      });
    }

    const stats = calculateDayStats(daySchedule.sessions);

    currentWeek[dateStr] = {
      day_of_week: index,
      enabled: daySchedule.enabled,
      total_active_minutes: stats.totalActiveMinutes,
      slots,
    };
  });

  return {
    bot_id: botId,
    schedule_version: schedule.version,
    timezone: schedule.timezone,
    current_week: currentWeek,
    generated_at: Date.now(),
  };
}
