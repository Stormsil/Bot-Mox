import dayjs, { type Dayjs } from 'dayjs';
import type { CalendarViewMode } from './types';

export const CALENDAR_VIEW_STORAGE_KEY = 'workspace_calendar_view_mode';

export const getInitialCalendarView = (): CalendarViewMode => {
  if (typeof window === 'undefined') {
    return 'month';
  }
  const stored = localStorage.getItem(CALENDAR_VIEW_STORAGE_KEY);
  return stored === 'week' || stored === 'month' ? stored : 'month';
};

export const getWeekStart = (date: Dayjs): Dayjs => {
  const dayOfWeek = date.day();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  return date.add(diffToMonday, 'day').startOf('day');
};

export const mapEventsByDate = <T extends { date: string }>(events: T[]) => {
  const map = new Map<string, T[]>();
  events.forEach((event) => {
    const dayEvents = map.get(event.date) ?? [];
    dayEvents.push(event);
    map.set(event.date, dayEvents);
  });
  return map;
};

export const getTodayStart = () => dayjs().startOf('day');
