import type { TabType } from '../../../components/layout/ContentPanel';
import type { ExtendedBot, ScheduleEntryState, ScheduleSessionState } from './types';

export const getScheduleStats = (bot: ExtendedBot | null) => {
  if (!bot?.schedule || typeof bot.schedule !== 'object') {
    return { totalSessions: 0, enabledSessions: 0 };
  }

  const scheduleRecord = bot.schedule as Record<string, unknown>;
  const rawDayEntries: unknown[] =
    scheduleRecord?.days && typeof scheduleRecord.days === 'object'
      ? Object.values(scheduleRecord.days as Record<string, unknown>)
      : Object.values(scheduleRecord);
  const dayEntries = rawDayEntries as ScheduleEntryState[];

  const sessionsList = dayEntries.flatMap((entry): ScheduleSessionState[] => {
    if (Array.isArray(entry)) {
      return entry;
    }
    if (entry && typeof entry === 'object' && Array.isArray(entry.sessions)) {
      return entry.sessions;
    }
    return [];
  });

  const totalSessions = sessionsList.length;
  const enabledSessions = sessionsList.filter((entry) => entry?.enabled).length;

  return { totalSessions, enabledSessions };
};

export const isAccountComplete = (bot: ExtendedBot | null) =>
  !!(bot?.account?.email?.trim() && bot?.account?.password?.trim());

export const isPersonComplete = (bot: ExtendedBot | null) =>
  !!(
    bot?.person?.first_name?.trim() &&
    bot?.person?.last_name?.trim() &&
    bot?.person?.birth_date?.trim() &&
    bot?.person?.country?.trim() &&
    bot?.person?.city?.trim() &&
    bot?.person?.address?.trim() &&
    bot?.person?.zip?.trim()
  );

export const isCharacterComplete = (bot: ExtendedBot | null) =>
  !!(
    bot?.character?.name?.trim() &&
    bot?.character?.server?.trim() &&
    bot?.character?.faction &&
    bot?.character?.race?.trim() &&
    bot?.character?.class?.trim()
  );

export const isScheduleComplete = (enabledSessions: number) => enabledSessions > 0;

export const isPersonDataIncomplete = (bot: ExtendedBot | null): boolean => !isPersonComplete(bot);

export const isAccountDataIncomplete = (bot: ExtendedBot | null): boolean => !isAccountComplete(bot);

export const getIncompleteTabs = (bot: ExtendedBot | null): TabType[] => {
  if (isPersonDataIncomplete(bot) || isAccountDataIncomplete(bot)) {
    return ['configure'];
  }
  return [];
};
