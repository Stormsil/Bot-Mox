import { useCallback } from 'react';
import type { VMLogEntry } from '../types';
import { nextLogId } from './vmLogUtils';

interface UseVmLogWritersParams {
  push: (entry: VMLogEntry) => void;
}

export function useVmLogWriters({ push }: UseVmLogWritersParams) {
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

  return {
    info,
    warn,
    error,
    debug,
    step,
    table,
    diffTable,
  };
}
