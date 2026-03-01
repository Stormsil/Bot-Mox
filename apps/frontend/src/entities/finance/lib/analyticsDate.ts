import dayjs from 'dayjs';
import { parseIsoLikeToTimestamp } from '../../../shared/lib/date';

export function parseDateToTimestamp(dateString: string): number {
  if (!dateString || typeof dateString !== 'string') {
    return Number.NaN;
  }

  const dateStr = dateString.includes(' ') ? dateString : `${dateString} 00:00:00`;
  const timestamp = parseIsoLikeToTimestamp(dateStr.replace(' ', 'T'));

  if (Number.isNaN(timestamp)) {
    return Number.NaN;
  }

  return timestamp;
}

export function formatTimestampToDay(timestamp: number): string {
  return dayjs(timestamp).format('YYYY-MM-DD');
}
