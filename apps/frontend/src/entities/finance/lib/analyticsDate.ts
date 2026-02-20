export function parseDateToTimestamp(dateString: string): number {
  if (!dateString || typeof dateString !== 'string') {
    return Number.NaN;
  }

  const dateStr = dateString.includes(' ') ? dateString : `${dateString} 00:00:00`;
  const date = new Date(dateStr.replace(' ', 'T'));
  const timestamp = date.getTime();

  if (Number.isNaN(timestamp)) {
    return Number.NaN;
  }

  return timestamp;
}

export function formatTimestampToDay(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
