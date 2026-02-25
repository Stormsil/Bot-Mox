import dayjs, { type ManipulateType } from 'dayjs';
import duration from 'dayjs/plugin/duration';

dayjs.extend(duration);

export function subtractNow(value: number, unit: ManipulateType): number {
  return dayjs().subtract(value, unit).valueOf();
}

export function formatDurationHoursMinutes(ms: number): string {
  const d = dayjs.duration(Math.max(0, ms));
  const hours = Math.floor(d.asHours());
  const minutes = d.minutes();
  return `${hours}h ${minutes}m`;
}

export function formatDateDotted(timestamp: number): string {
  return dayjs(timestamp).format('DD.MM.YYYY');
}

export function formatTimestampToDateTime(timestamp: number): string {
  return dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss');
}

export function parseRussianDate(value: string): number {
  const [day, month, year] = String(value || '')
    .split('.')
    .map(Number);

  return dayjs()
    .year(year)
    .month(month - 1)
    .date(day)
    .hour(0)
    .minute(0)
    .second(0)
    .millisecond(0)
    .valueOf();
}

export function parseIsoLikeToTimestamp(value: string): number {
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.valueOf() : Number.NaN;
}

export function formatNoteSidebarDate(timestamp: number): string {
  const date = dayjs(timestamp);
  const now = dayjs();
  const diffDays = now.startOf('day').diff(date.startOf('day'), 'day');

  if (diffDays === 0) {
    return date.format('hh:mm A');
  }

  if (diffDays === 1) {
    return 'Yesterday';
  }

  if (diffDays < 7) {
    return date.format('ddd');
  }

  return date.format('MMM D');
}
