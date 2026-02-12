import { useState, useEffect, useCallback } from 'react';
import { apiGet, createPollingSubscription } from '../services/apiClient';

interface UseFirebaseDataOptions<T> {
  path: string;
  transform?: (data: unknown) => T;
  enabled?: boolean;
}

interface UseFirebaseDataResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

interface ResolvedApiPath {
  endpoint: string;
  paginated: boolean;
}

const FETCH_LIMIT = 200;
const DEFAULT_POLL_INTERVAL_MS = 4000;

function normalizePath(path: string): string {
  return String(path || '').trim().replace(/^\/+/, '').replace(/\/+$/, '');
}

function resolveApiPath(path: string): ResolvedApiPath {
  const normalized = normalizePath(path);
  if (!normalized) {
    return { endpoint: '/api/v1/settings', paginated: false };
  }

  if (normalized === 'settings') return { endpoint: '/api/v1/settings', paginated: false };
  if (normalized.startsWith('settings/')) {
    return { endpoint: `/api/v1/settings/${normalized.slice('settings/'.length)}`, paginated: false };
  }

  if (normalized === 'bots') return { endpoint: '/api/v1/bots', paginated: true };
  if (normalized.startsWith('bots/')) {
    return { endpoint: `/api/v1/bots/${normalized.slice('bots/'.length)}`, paginated: false };
  }

  if (normalized.startsWith('resources/')) {
    const [, kind, ...rest] = normalized.split('/');
    if (!kind) return { endpoint: '/api/v1/resources', paginated: false };
    if (rest.length === 0) return { endpoint: `/api/v1/resources/${kind}`, paginated: true };
    return { endpoint: `/api/v1/resources/${kind}/${rest.join('/')}`, paginated: false };
  }

  if (normalized === 'workspace/notes_v2') return { endpoint: '/api/v1/workspace/notes', paginated: true };
  if (normalized.startsWith('workspace/notes_v2/')) {
    return { endpoint: `/api/v1/workspace/notes/${normalized.slice('workspace/notes_v2/'.length)}`, paginated: false };
  }

  if (normalized === 'workspace/calendar_events') return { endpoint: '/api/v1/workspace/calendar', paginated: true };
  if (normalized.startsWith('workspace/calendar_events/')) {
    return { endpoint: `/api/v1/workspace/calendar/${normalized.slice('workspace/calendar_events/'.length)}`, paginated: false };
  }

  if (normalized === 'workspace/kanban_tasks') return { endpoint: '/api/v1/workspace/kanban', paginated: true };
  if (normalized.startsWith('workspace/kanban_tasks/')) {
    return { endpoint: `/api/v1/workspace/kanban/${normalized.slice('workspace/kanban_tasks/'.length)}`, paginated: false };
  }

  if (normalized === 'finance/operations') return { endpoint: '/api/v1/finance/operations', paginated: true };
  if (normalized.startsWith('finance/operations/')) {
    return { endpoint: `/api/v1/finance/operations/${normalized.slice('finance/operations/'.length)}`, paginated: false };
  }
  if (normalized === 'finance/daily_stats') return { endpoint: '/api/v1/finance/daily-stats', paginated: false };

  return { endpoint: `/api/v1/settings/${normalized}`, paginated: false };
}

async function loadPaginated(endpoint: string): Promise<unknown[]> {
  let page = 1;
  let guard = 0;
  const all: unknown[] = [];

  while (guard < 1000) {
    guard += 1;
    const separator = endpoint.includes('?') ? '&' : '?';
    const response = await apiGet<unknown[]>(`${endpoint}${separator}page=${page}&limit=${FETCH_LIMIT}`);
    const items = Array.isArray(response.data) ? response.data : [];
    all.push(...items);

    const totalRaw = Number(response.meta?.total ?? NaN);
    const total = Number.isFinite(totalRaw) ? totalRaw : undefined;
    if (items.length < FETCH_LIMIT) break;
    if (total !== undefined && all.length >= total) break;
    page += 1;
  }

  return all;
}

async function loadPath(path: string): Promise<unknown> {
  const resolved = resolveApiPath(path);
  if (resolved.paginated) {
    return loadPaginated(resolved.endpoint);
  }
  const response = await apiGet<unknown>(resolved.endpoint);
  return response.data;
}

export function useFirebaseData<T>({
  path,
  transform,
  enabled = true,
}: UseFirebaseDataOptions<T>): UseFirebaseDataResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refetch = useCallback(() => {
    setLoading(true);
    setError(null);
    setRefreshKey((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      return () => undefined;
    }

    Promise.resolve().then(() => {
      setLoading(true);
      setError(null);
    });

    const unsubscribe = createPollingSubscription(
      async () => {
        const rawData = await loadPath(path);
        return transform ? transform(rawData) : (rawData as T);
      },
      (nextData) => {
        setData(nextData);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error(`API data error at ${path}:`, err);
        setError(err);
        setLoading(false);
      },
      { intervalMs: DEFAULT_POLL_INTERVAL_MS, immediate: true }
    );

    return () => {
      unsubscribe();
    };
  }, [path, transform, enabled, refreshKey]);

  return { data, loading: enabled ? loading : false, error: enabled ? error : null, refetch };
}

export function useFirebaseList<T>({
  path,
  enabled = true,
}: Omit<UseFirebaseDataOptions<T[]>, 'transform'>): UseFirebaseDataResult<T[]> {
  const transform = useCallback((data: unknown): T[] => {
    if (!data) return [];
    if (Array.isArray(data)) return data as T[];
    return Object.entries(data as Record<string, unknown>).map(([id, value]) => ({
      id,
      ...(typeof value === 'object' && value !== null ? value : { value }),
    })) as T[];
  }, []);

  return useFirebaseData<T[]>({ path, transform, enabled });
}

export function useExpiredStatus() {
  const isExpired = useCallback((expiresAt: number): boolean => {
    return Date.now() > expiresAt;
  }, []);

  const isExpiringSoon = useCallback((expiresAt: number, daysThreshold: number = 7): boolean => {
    const daysRemaining = Math.ceil((expiresAt - Date.now()) / (1000 * 60 * 60 * 24));
    return daysRemaining <= daysThreshold && daysRemaining > 0;
  }, []);

  const getDaysRemaining = useCallback((expiresAt: number): number => {
    return Math.ceil((expiresAt - Date.now()) / (1000 * 60 * 60 * 24));
  }, []);

  return { isExpired, isExpiringSoon, getDaysRemaining };
}

export function useOfflineStatus(timeoutMinutes: number = 5) {
  const isOffline = useCallback((lastSeen: number): boolean => {
    const lastSeenMinutes = Math.floor((Date.now() - lastSeen) / (1000 * 60));
    return lastSeenMinutes > timeoutMinutes;
  }, [timeoutMinutes]);

  const getLastSeenMinutes = useCallback((lastSeen: number): number => {
    return Math.floor((Date.now() - lastSeen) / (1000 * 60));
  }, []);

  return { isOffline, getLastSeenMinutes };
}
