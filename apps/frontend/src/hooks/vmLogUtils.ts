import type {
  VMLogDiff,
  VMLogEntry,
  VMLogTable,
  VMOperationLog,
  VMTaskDetailLevel,
  VMTaskEntry,
  VMTaskStatus,
} from '../types';

let logIdCounter = 0;
let taskIdCounter = 0;

export const RUNNING_TASK_TIMEOUT_MS = 10 * 60 * 1000;

export function nextLogId(): string {
  return `log_${Date.now()}_${++logIdCounter}`;
}

export function nextTaskId(): string {
  return `task_${Date.now()}_${++taskIdCounter}`;
}

export function taskLevelFromStatus(status: VMTaskStatus): VMTaskDetailLevel {
  if (status === 'error') return 'error';
  if (status === 'cancelled') return 'warn';
  return 'info';
}

function normalizeTaskStatus(status: unknown): VMTaskStatus {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'ok') return 'ok';
  if (normalized === 'error') return 'error';
  if (normalized === 'cancelled') return 'cancelled';
  return 'running';
}

function normalizeTaskDetailLevel(level: unknown): VMTaskDetailLevel {
  const normalized = String(level || '').toLowerCase();
  if (normalized === 'warn') return 'warn';
  if (normalized === 'error') return 'error';
  return 'info';
}

export function parsePersistedTasks(data: unknown): VMTaskEntry[] {
  const list = Array.isArray(data)
    ? data
    : data && typeof data === 'object'
      ? Object.values(data as Record<string, unknown>)
      : [];

  return list
    .map((item, index): VMTaskEntry | null => {
      if (!item || typeof item !== 'object') return null;
      const raw = item as Record<string, unknown>;
      const id = String(raw.id || '').trim() || `persisted_task_${index}_${Date.now()}`;
      const key = String(raw.key || '').trim() || id;
      const description = String(raw.description || '').trim() || 'VM Task';
      const startedAtValue = Number(raw.startedAt);
      const startedAt =
        Number.isFinite(startedAtValue) && startedAtValue > 0 ? startedAtValue : Date.now();
      const finishedAtValue = Number(raw.finishedAt);
      const finishedAt =
        Number.isFinite(finishedAtValue) && finishedAtValue > 0 ? finishedAtValue : undefined;
      const detailsRaw = Array.isArray(raw.details) ? raw.details : [];
      const details = detailsRaw
        .map((detail, detailIndex): VMTaskEntry['details'][number] | null => {
          if (!detail || typeof detail !== 'object') return null;
          const rawDetail = detail as Record<string, unknown>;
          const timestampValue = Number(rawDetail.timestamp);
          const timestamp =
            Number.isFinite(timestampValue) && timestampValue > 0 ? timestampValue : startedAt;
          return {
            id: String(rawDetail.id || '').trim() || `persisted_log_${id}_${detailIndex}`,
            timestamp,
            level: normalizeTaskDetailLevel(rawDetail.level),
            message: String(rawDetail.message || '').trim() || '(empty)',
          };
        })
        .filter((detail): detail is VMTaskEntry['details'][number] => Boolean(detail))
        .sort((a, b) => a.timestamp - b.timestamp);

      return {
        id,
        key,
        description,
        node: String(raw.node || '').trim() || '-',
        userName: String(raw.userName || '').trim() || '-',
        vmName: String(raw.vmName || '').trim() || undefined,
        startedAt,
        finishedAt,
        status: normalizeTaskStatus(raw.status),
        details,
      };
    })
    .filter((task): task is VMTaskEntry => Boolean(task))
    .sort((a, b) => a.startedAt - b.startedAt);
}

export function hasTaskTimedOut(task: VMTaskEntry, now: number): boolean {
  if (task.status !== 'running') return false;
  if (!Number.isFinite(task.startedAt) || task.startedAt <= 0) return false;
  return now - task.startedAt >= RUNNING_TASK_TIMEOUT_MS;
}

export function formatFullLog(entries: VMLogEntry[]): string {
  return entries
    .map((entry) => {
      const time = new Date(entry.timestamp).toLocaleTimeString();
      const vm = entry.vmName ? `[${entry.vmName}] ` : '';

      if (entry.level === 'table') {
        const t = entry as VMLogTable;
        const rowLines = t.rows.map((r) => `  ${r.field}: ${r.value}`).join('\n');
        return `[${time}] ${vm}${t.title}\n${rowLines}`;
      }
      if (entry.level === 'diff') {
        const d = entry as VMLogDiff;
        const changeLines = d.changes
          .map((c) => `  ${c.field}: ${c.oldValue} -> ${c.newValue}`)
          .join('\n');
        return `[${time}] ${vm}${d.title}\n${changeLines}`;
      }
      if (entry.level === 'step') {
        return `[${time}] ${vm}> ${(entry as VMOperationLog).message}`;
      }
      return `[${time}] ${vm}[${entry.level.toUpperCase()}] ${(entry as VMOperationLog).message}`;
    })
    .join('\n');
}
