import { useCallback, useEffect, useRef, useState } from 'react';
import { uiLogger } from '../observability/uiLogger';
import { apiGet, apiPut, createPollingSubscription } from '../services/apiClient';
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
const VM_LOG_TASKS_API_PATH = '/api/v1/settings/vmgenerator/task_logs';
const LOG_PERSIST_DEBOUNCE_MS = 250;
const RUNNING_TASK_TIMEOUT_MS = 10 * 60 * 1000;
const RUNNING_TASK_SWEEP_INTERVAL_MS = 15_000;

async function loadPersistedTasks(): Promise<VMTaskEntry[]> {
  const response = await apiGet<unknown>(VM_LOG_TASKS_API_PATH);
  return parsePersistedTasks(response.data);
}

function nextLogId(): string {
  return `log_${Date.now()}_${++logIdCounter}`;
}

function nextTaskId(): string {
  return `task_${Date.now()}_${++taskIdCounter}`;
}

interface StartTaskMeta {
  node?: string;
  userName?: string;
  vmName?: string;
}

function taskLevelFromStatus(status: VMTaskStatus): VMTaskDetailLevel {
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

function parsePersistedTasks(data: unknown): VMTaskEntry[] {
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

function hasTaskTimedOut(task: VMTaskEntry, now: number): boolean {
  if (task.status !== 'running') return false;
  if (!Number.isFinite(task.startedAt) || task.startedAt <= 0) return false;
  return now - task.startedAt >= RUNNING_TASK_TIMEOUT_MS;
}

export function useVMLog() {
  const [entries, setEntries] = useState<VMLogEntry[]>([]);
  const [tasks, setTasks] = useState<VMTaskEntry[]>([]);
  const entriesRef = useRef<VMLogEntry[]>([]);
  const tasksRef = useRef<VMTaskEntry[]>([]);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydratedRef = useRef(false);
  const lastPersistedHashRef = useRef('');

  const persistTasks = useCallback((nextTasks: VMTaskEntry[]) => {
    if (!hydratedRef.current) return;
    const serialized = JSON.stringify(nextTasks);
    if (serialized === lastPersistedHashRef.current) return;

    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
    }

    persistTimerRef.current = setTimeout(() => {
      apiPut(VM_LOG_TASKS_API_PATH, nextTasks)
        .then(() => {
          lastPersistedHashRef.current = serialized;
        })
        .catch((error) => {
          uiLogger.error('Failed to persist VM tasks:', error);
        })
        .finally(() => {
          persistTimerRef.current = null;
        });
    }, LOG_PERSIST_DEBOUNCE_MS);
  }, []);

  const persistTasksImmediately = useCallback(async (nextTasks: VMTaskEntry[]) => {
    const serialized = JSON.stringify(nextTasks);
    if (serialized === lastPersistedHashRef.current) return;

    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    }

    await apiPut(VM_LOG_TASKS_API_PATH, nextTasks);
    lastPersistedHashRef.current = serialized;
  }, []);

  useEffect(() => {
    const applyHydratedTasks = (parsed: VMTaskEntry[]) => {
      const serialized = JSON.stringify(parsed);
      if (hydratedRef.current && serialized === lastPersistedHashRef.current) {
        return;
      }
      tasksRef.current = parsed;
      setTasks(parsed);
      lastPersistedHashRef.current = serialized;
      hydratedRef.current = true;
    };

    const unsubscribe = createPollingSubscription(
      async () => loadPersistedTasks(),
      applyHydratedTasks,
      (error) => {
        uiLogger.error('Failed to load VM task history:', error);
        hydratedRef.current = true;
      },
      { key: 'settings:vmgenerator:task_logs', intervalMs: 4000, immediate: true },
    );

    return () => {
      unsubscribe();
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
    };
  }, []);

  const push = useCallback((entry: VMLogEntry) => {
    entriesRef.current = [...entriesRef.current, entry];
    setEntries(entriesRef.current);
  }, []);

  const updateTask = useCallback(
    (taskKey: string, updater: (task: VMTaskEntry) => VMTaskEntry) => {
      const idx = tasksRef.current.findIndex((task) => task.key === taskKey);
      if (idx < 0) return;
      const current = tasksRef.current[idx];
      const next = updater(current);
      const cloned = [...tasksRef.current];
      cloned[idx] = next;
      tasksRef.current = cloned;
      setTasks(cloned);
      persistTasks(cloned);
    },
    [persistTasks],
  );

  const closeRunningTaskById = useCallback(
    (taskId: string, status: VMTaskStatus, summary: string, level: VMTaskDetailLevel): boolean => {
      const idx = tasksRef.current.findIndex((task) => task.id === taskId);
      if (idx < 0) return false;
      const current = tasksRef.current[idx];
      if (current.status !== 'running') return false;

      const now = Date.now();
      const updated: VMTaskEntry = {
        ...current,
        status,
        finishedAt: now,
        details: [
          ...current.details,
          {
            id: nextLogId(),
            timestamp: now,
            level,
            message: summary,
          },
        ],
      };

      const cloned = [...tasksRef.current];
      cloned[idx] = updated;
      tasksRef.current = cloned;
      setTasks(cloned);
      persistTasks(cloned);
      return true;
    },
    [persistTasks],
  );

  const startTask = useCallback(
    (taskKey: string, description: string, meta?: StartTaskMeta) => {
      const now = Date.now();
      const idx = tasksRef.current.findIndex((task) => task.key === taskKey);

      if (idx >= 0) {
        const existing = tasksRef.current[idx];
        const updated: VMTaskEntry = {
          ...existing,
          description,
          node: meta?.node || existing.node || '-',
          userName: meta?.userName || existing.userName || '-',
          vmName: meta?.vmName || existing.vmName,
          startedAt: now,
          finishedAt: undefined,
          status: 'running',
          details: [],
        };
        const cloned = [...tasksRef.current];
        cloned[idx] = updated;
        tasksRef.current = cloned;
        setTasks(cloned);
        persistTasks(cloned);
        return;
      }

      const created: VMTaskEntry = {
        id: nextTaskId(),
        key: taskKey,
        description,
        node: meta?.node || '-',
        userName: meta?.userName || '-',
        vmName: meta?.vmName,
        startedAt: now,
        status: 'running',
        details: [],
      };
      tasksRef.current = [...tasksRef.current, created];
      setTasks(tasksRef.current);
      persistTasks(tasksRef.current);
    },
    [persistTasks],
  );

  const taskLog = useCallback(
    (taskKey: string, message: string, level: VMTaskDetailLevel = 'info') => {
      const idx = tasksRef.current.findIndex((task) => task.key === taskKey);
      if (idx < 0) return;

      updateTask(taskKey, (task) => ({
        ...task,
        details: [
          ...task.details,
          {
            id: nextLogId(),
            timestamp: Date.now(),
            level,
            message,
          },
        ],
      }));
    },
    [updateTask],
  );

  const finishTask = useCallback(
    (taskKey: string, status: VMTaskStatus, summary?: string) => {
      const now = Date.now();
      updateTask(taskKey, (task) => ({
        ...(task.status !== 'running'
          ? task
          : {
              ...task,
              status,
              finishedAt: now,
              details: summary
                ? [
                    ...task.details,
                    {
                      id: nextLogId(),
                      timestamp: now,
                      level: taskLevelFromStatus(status),
                      message: summary,
                    },
                  ]
                : task.details,
            }),
      }));
    },
    [updateTask],
  );

  const cancelTask = useCallback(
    (taskId: string, reason?: string): boolean => {
      const summary =
        String(reason || '').trim() || 'Task cancelled by user from Operation Console';
      return closeRunningTaskById(taskId, 'cancelled', summary, 'warn');
    },
    [closeRunningTaskById],
  );

  const timeoutStaleRunningTasks = useCallback(() => {
    const now = Date.now();
    let changed = false;

    const nextTasks = tasksRef.current.map((task) => {
      if (!hasTaskTimedOut(task, now)) {
        return task;
      }

      changed = true;
      return {
        ...task,
        status: 'error' as VMTaskStatus,
        finishedAt: now,
        details: [
          ...task.details,
          {
            id: nextLogId(),
            timestamp: now,
            level: 'error' as VMTaskDetailLevel,
            message: `Task timed out after ${Math.trunc(RUNNING_TASK_TIMEOUT_MS / 60000)} minutes and was auto-stopped.`,
          },
        ],
      };
    });

    if (!changed) {
      return;
    }

    tasksRef.current = nextTasks;
    setTasks(nextTasks);
    persistTasks(nextTasks);
  }, [persistTasks]);

  const info = useCallback(
    (message: string, vmName?: string) => {
      push({
        id: nextLogId(),
        timestamp: Date.now(),
        level: 'info',
        message,
        vmName,
      } as VMOperationLog);
    },
    [push],
  );

  const warn = useCallback(
    (message: string, vmName?: string) => {
      push({
        id: nextLogId(),
        timestamp: Date.now(),
        level: 'warn',
        message,
        vmName,
      } as VMOperationLog);
    },
    [push],
  );

  const error = useCallback(
    (message: string, vmName?: string) => {
      push({
        id: nextLogId(),
        timestamp: Date.now(),
        level: 'error',
        message,
        vmName,
      } as VMOperationLog);
    },
    [push],
  );

  const debug = useCallback(
    (message: string, vmName?: string) => {
      push({
        id: nextLogId(),
        timestamp: Date.now(),
        level: 'debug',
        message,
        vmName,
      } as VMOperationLog);
    },
    [push],
  );

  const step = useCallback(
    (message: string, vmName?: string) => {
      push({
        id: nextLogId(),
        timestamp: Date.now(),
        level: 'step',
        message,
        vmName,
      } as VMOperationLog);
    },
    [push],
  );

  const table = useCallback(
    (title: string, rows: Array<{ field: string; value: string }>, vmName?: string) => {
      push({
        id: nextLogId(),
        timestamp: Date.now(),
        level: 'table',
        title,
        rows,
        vmName,
      } as VMLogTable);
    },
    [push],
  );

  const diffTable = useCallback(
    (
      title: string,
      changes: Array<{ field: string; oldValue: string; newValue: string }>,
      vmName?: string,
    ) => {
      push({
        id: nextLogId(),
        timestamp: Date.now(),
        level: 'diff',
        title,
        changes,
        vmName,
      } as VMLogDiff);
    },
    [push],
  );

  const clear = useCallback(async () => {
    entriesRef.current = [];
    tasksRef.current = [];
    setEntries([]);
    setTasks([]);
    hydratedRef.current = true;
    await persistTasksImmediately([]);
  }, [persistTasksImmediately]);

  useEffect(() => {
    const timer = setInterval(() => {
      timeoutStaleRunningTasks();
    }, RUNNING_TASK_SWEEP_INTERVAL_MS);

    timeoutStaleRunningTasks();

    return () => clearInterval(timer);
  }, [timeoutStaleRunningTasks]);

  const getFullLog = useCallback((): string => {
    return entriesRef.current
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
  }, []);

  return {
    entries,
    tasks,
    startTask,
    taskLog,
    finishTask,
    info,
    warn,
    error,
    debug,
    step,
    table,
    diffTable,
    cancelTask,
    clear,
    getFullLog,
  };
}

export type VMLog = ReturnType<typeof useVMLog>;
