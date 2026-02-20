import type { VMTaskDetailEntry, VMTaskEntry, VMTaskStatus } from '../../types';

export function formatClock(ts: number): string {
  return new Date(ts).toLocaleTimeString();
}

export function formatTaskDate(ts?: number): string {
  if (!ts) return '-';
  return new Date(ts)
    .toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
    .replace(',', '');
}

export function statusLabel(status: VMTaskStatus): string {
  switch (status) {
    case 'ok':
      return 'OK';
    case 'error':
      return 'Error';
    case 'cancelled':
      return 'Cancelled';
    default:
      return 'Running';
  }
}

export function formatTaskDetailLine(entry: VMTaskDetailEntry): string {
  const levelPrefix = entry.level === 'info' ? '' : ` ${entry.level.toUpperCase()}:`;
  return `[${formatClock(entry.timestamp)}]${levelPrefix} ${entry.message}`;
}

export function splitDiffMessage(message: string): {
  prefix: string;
  oldValue: string;
  newValue: string;
} | null {
  const arrowIndex = message.indexOf('->');
  if (arrowIndex <= 0) return null;

  const left = message.slice(0, arrowIndex).trimEnd();
  const right = message.slice(arrowIndex + 2).trimStart();
  if (!left || !right) return null;

  const fieldMatch = left.match(/^(\s*[^:]+:\s*)([\s\S]*)$/);
  if (fieldMatch) {
    return {
      prefix: fieldMatch[1],
      oldValue: fieldMatch[2] || '(empty)',
      newValue: right || '(empty)',
    };
  }

  return {
    prefix: '',
    oldValue: left,
    newValue: right,
  };
}

export function getTaskText(task: VMTaskEntry): string {
  const head = [
    `Description: ${task.description}`,
    `Node: ${task.node}`,
    `User: ${task.userName}`,
    `Status: ${statusLabel(task.status)}`,
    `Start: ${formatTaskDate(task.startedAt)}`,
    `End: ${formatTaskDate(task.finishedAt)}`,
  ].join('\n');

  const details = task.details.map(formatTaskDetailLine).join('\n');

  return `${head}\n\n${details}`;
}
