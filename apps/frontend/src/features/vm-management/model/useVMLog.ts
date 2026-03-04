import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { uiLogger } from '../../../observability/uiLogger';
import { apiPut } from '../../../shared/api/apiClient';
import type {
  VMLogEntry,
  VMTaskDetailLevel,
  VMTaskEntry,
  VMTaskStatus,
} from '../../../shared/types';
import { useVmWorkspaceStore } from '../../../widgets/vm-workspace/model/useVmWorkspaceStore';
import {
  formatFullLog,
  hasTaskTimedOut,
  nextLogId,
  nextTaskId,
  RUNNING_TASK_TIMEOUT_MS,
  taskLevelFromStatus,
} from './vmLogUtils';
import { useVmLogWriters } from './vmLogWriters';
import { loadPersistedTasks } from './vmTaskHistoryPersistence';

const LOG_PERSIST_DEBOUNCE_MS = 250;
const RUNNING_TASK_SWEEP_INTERVAL_MS = 15_000;
const VM_LOG_TASKS_API_PATH = '/api/v1/settings/vmgenerator/task_logs';

interface StartTaskMeta {
  node?: string;
  userName?: string;
  vmName?: string;
}

interface PersistSnapshot {
  seq: number;
  serialized: string;
  tasks: VMTaskEntry[];
}

export function useVMLog() {
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydratedRef = useRef(false);
  const lastPersistedHashRef = useRef('');
  const lastQueuedHashRef = useRef('');
  const persistSeqRef = useRef(0);
  const lastEnqueuedSeqRef = useRef(0);
  const lastCommittedSeqRef = useRef(0);
  const pendingPersistSnapshotRef = useRef<PersistSnapshot | null>(null);
  const flushInFlightRef = useRef<Promise<void> | null>(null);
  const { data: hydratedTasksData, error: hydratedTasksError } = useQuery<VMTaskEntry[], Error>({
    queryKey: ['settings', 'vmgenerator', 'task_logs'],
    queryFn: loadPersistedTasks,
    retry: false,
  });

  const flushLatestTasks = useCallback(async (): Promise<void> => {
    if (flushInFlightRef.current) {
      await flushInFlightRef.current;
      return;
    }

    const run = (async () => {
      while (true) {
        const snapshot = pendingPersistSnapshotRef.current;
        if (!snapshot) {
          return;
        }

        if (snapshot.serialized === lastPersistedHashRef.current) {
          if (pendingPersistSnapshotRef.current?.seq === snapshot.seq) {
            pendingPersistSnapshotRef.current = null;
          }
          lastQueuedHashRef.current = lastPersistedHashRef.current;
          lastCommittedSeqRef.current = Math.max(lastCommittedSeqRef.current, snapshot.seq);
          continue;
        }

        try {
          await apiPut(VM_LOG_TASKS_API_PATH, snapshot.tasks);
          lastPersistedHashRef.current = snapshot.serialized;
          lastCommittedSeqRef.current = snapshot.seq;
        } catch (error) {
          uiLogger.error('Failed to persist VM tasks:', error);
          lastQueuedHashRef.current = lastPersistedHashRef.current;
          return;
        } finally {
          if (pendingPersistSnapshotRef.current?.seq === snapshot.seq) {
            pendingPersistSnapshotRef.current = null;
          }
        }
      }
    })().finally(() => {
      flushInFlightRef.current = null;
    });

    flushInFlightRef.current = run;
    await run;

    if (
      pendingPersistSnapshotRef.current &&
      pendingPersistSnapshotRef.current.seq > lastCommittedSeqRef.current
    ) {
      await flushLatestTasks();
    }
  }, []);

  const enqueuePersistSnapshot = useCallback((nextTasks: VMTaskEntry[]) => {
    const serialized = JSON.stringify(nextTasks);
    if (serialized === lastPersistedHashRef.current || serialized === lastQueuedHashRef.current) {
      return null;
    }

    const seq = persistSeqRef.current + 1;
    persistSeqRef.current = seq;
    lastEnqueuedSeqRef.current = seq;
    lastQueuedHashRef.current = serialized;
    pendingPersistSnapshotRef.current = {
      seq,
      serialized,
      tasks: nextTasks,
    };

    return seq;
  }, []);

  const persistTasks = useCallback(
    (nextTasks: VMTaskEntry[]) => {
      if (!hydratedRef.current) return;
      const seq = enqueuePersistSnapshot(nextTasks);
      if (seq == null) return;

      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
      }

      persistTimerRef.current = setTimeout(() => {
        persistTimerRef.current = null;
        void flushLatestTasks();
      }, LOG_PERSIST_DEBOUNCE_MS);
    },
    [enqueuePersistSnapshot, flushLatestTasks],
  );

  const persistTasksImmediately = useCallback(
    async (nextTasks: VMTaskEntry[]) => {
      enqueuePersistSnapshot(nextTasks);

      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }

      await flushLatestTasks();
    },
    [enqueuePersistSnapshot, flushLatestTasks],
  );

  useEffect(() => {
    const applyHydratedTasks = (parsed: VMTaskEntry[]) => {
      const serialized = JSON.stringify(parsed);
      if (hydratedRef.current && serialized === lastPersistedHashRef.current) {
        return;
      }
      useVmWorkspaceStore.getState().logsActions.setTasks(parsed);
      lastPersistedHashRef.current = serialized;
      lastQueuedHashRef.current = serialized;
      hydratedRef.current = true;
    };

    if (hydratedTasksData) {
      applyHydratedTasks(hydratedTasksData);
    }

    if (hydratedTasksError) {
      uiLogger.error('Failed to load VM task history:', hydratedTasksError);
      hydratedRef.current = true;
    }
  }, [hydratedTasksData, hydratedTasksError]);

  useEffect(
    () => () => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
    },
    [],
  );

  const push = useCallback((entry: VMLogEntry) => {
    useVmWorkspaceStore.getState().logsActions.addLogEntry(entry);
  }, []);

  const getTasks = useCallback((): VMTaskEntry[] => useVmWorkspaceStore.getState().logs.tasks, []);

  const setStoreTasks = useCallback((nextTasks: VMTaskEntry[]) => {
    useVmWorkspaceStore.getState().logsActions.setTasks(nextTasks);
  }, []);

  const updateTask = useCallback(
    (taskKey: string, updater: (task: VMTaskEntry) => VMTaskEntry) => {
      const currentTasks = getTasks();
      const idx = currentTasks.findIndex((task) => task.key === taskKey);
      if (idx < 0) return;
      const current = currentTasks[idx];
      const next = updater(current);
      const cloned = [...currentTasks];
      cloned[idx] = next;
      setStoreTasks(cloned);
      persistTasks(cloned);
    },
    [getTasks, persistTasks, setStoreTasks],
  );

  const closeRunningTaskById = useCallback(
    (taskId: string, status: VMTaskStatus, summary: string, level: VMTaskDetailLevel): boolean => {
      const currentTasks = getTasks();
      const idx = currentTasks.findIndex((task) => task.id === taskId);
      if (idx < 0) return false;
      const current = currentTasks[idx];
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

      const cloned = [...currentTasks];
      cloned[idx] = updated;
      setStoreTasks(cloned);
      persistTasks(cloned);
      return true;
    },
    [getTasks, persistTasks, setStoreTasks],
  );

  const startTask = useCallback(
    (taskKey: string, description: string, meta?: StartTaskMeta) => {
      const now = Date.now();
      const currentTasks = getTasks();
      const idx = currentTasks.findIndex((task) => task.key === taskKey);

      if (idx >= 0) {
        const existing = currentTasks[idx];
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
        const cloned = [...currentTasks];
        cloned[idx] = updated;
        setStoreTasks(cloned);
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
      const nextTasks = [...currentTasks, created];
      setStoreTasks(nextTasks);
      persistTasks(nextTasks);
    },
    [getTasks, persistTasks, setStoreTasks],
  );

  const taskLog = useCallback(
    (taskKey: string, message: string, level: VMTaskDetailLevel = 'info') => {
      const idx = getTasks().findIndex((task) => task.key === taskKey);
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
    [getTasks, updateTask],
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

    const currentTasks = getTasks();
    const nextTasks = currentTasks.map((task) => {
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

    setStoreTasks(nextTasks);
    persistTasks(nextTasks);
  }, [getTasks, persistTasks, setStoreTasks]);

  const { info, warn, error, debug, step, table, diffTable } = useVmLogWriters({ push });

  const clear = useCallback(async () => {
    useVmWorkspaceStore.getState().logsActions.setEntries([]);
    setStoreTasks([]);
    hydratedRef.current = true;
    await persistTasksImmediately([]);
  }, [persistTasksImmediately, setStoreTasks]);

  useEffect(() => {
    const timer = setInterval(() => {
      timeoutStaleRunningTasks();
    }, RUNNING_TASK_SWEEP_INTERVAL_MS);

    timeoutStaleRunningTasks();

    return () => clearInterval(timer);
  }, [timeoutStaleRunningTasks]);

  const getFullLog = useCallback(
    (): string => formatFullLog(useVmWorkspaceStore.getState().logs.entries),
    [],
  );

  return {
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
