import dayjs from 'dayjs';

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

export function formatNoteSidebarDate(timestamp: number): string {
  const date = dayjs(timestamp);
  const now = dayjs();
  const diffMs = now.valueOf() - date.valueOf();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

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

