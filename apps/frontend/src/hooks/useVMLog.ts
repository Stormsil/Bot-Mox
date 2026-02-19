import { useCallback, useEffect, useRef, useState } from 'react';
import { uiLogger } from '../observability/uiLogger';
import { apiGet, apiPut, createPollingSubscription } from '../services/apiClient';
import type { VMLogEntry, VMTaskDetailLevel, VMTaskEntry, VMTaskStatus } from '../types';
import {
  formatFullLog,
  hasTaskTimedOut,
  nextLogId,
  nextTaskId,
  parsePersistedTasks,
  RUNNING_TASK_TIMEOUT_MS,
  taskLevelFromStatus,
} from './vmLogUtils';

const VM_LOG_TASKS_API_PATH = '/api/v1/settings/vmgenerator/task_logs';
const LOG_PERSIST_DEBOUNCE_MS = 250;
const RUNNING_TASK_SWEEP_INTERVAL_MS = 15_000;

async function loadPersistedTasks(): Promise<VMTaskEntry[]> {
  const response = await apiGet<unknown>(VM_LOG_TASKS_API_PATH);
  return parsePersistedTasks(response.data);
}

interface StartTaskMeta {
  node?: string;
  userName?: string;
  vmName?: string;
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
      push({ id: nextLogId(), timestamp: Date.now(), level: 'info', message, vmName });
    },
    [push],
  );

  const warn = useCallback(
    (message: string, vmName?: string) => {
      push({ id: nextLogId(), timestamp: Date.now(), level: 'warn', message, vmName });
    },
    [push],
  );

  const error = useCallback(
    (message: string, vmName?: string) => {
      push({ id: nextLogId(), timestamp: Date.now(), level: 'error', message, vmName });
    },
    [push],
  );

  const debug = useCallback(
    (message: string, vmName?: string) => {
      push({ id: nextLogId(), timestamp: Date.now(), level: 'debug', message, vmName });
    },
    [push],
  );

  const step = useCallback(
    (message: string, vmName?: string) => {
      push({ id: nextLogId(), timestamp: Date.now(), level: 'step', message, vmName });
    },
    [push],
  );

  const table = useCallback(
    (title: string, rows: Array<{ field: string; value: string }>, vmName?: string) => {
      push({ id: nextLogId(), timestamp: Date.now(), level: 'table', title, rows, vmName });
    },
    [push],
  );

  const diffTable = useCallback(
    (
      title: string,
      changes: Array<{ field: string; oldValue: string; newValue: string }>,
      vmName?: string,
    ) => {
      push({ id: nextLogId(), timestamp: Date.now(), level: 'diff', title, changes, vmName });
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

  const getFullLog = useCallback((): string => formatFullLog(entriesRef.current), []);

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
