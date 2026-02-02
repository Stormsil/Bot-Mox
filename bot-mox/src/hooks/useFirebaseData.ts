import { useState, useEffect, useCallback } from 'react';
import { ref, onValue, off, DataSnapshot } from 'firebase/database';
import { database } from '../utils/firebase';

interface UseFirebaseDataOptions<T> {
  path: string;
  transform?: (data: any) => T;
  enabled?: boolean;
}

interface UseFirebaseDataResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useFirebaseData<T>({
  path,
  transform,
  enabled = true,
}: UseFirebaseDataOptions<T>): UseFirebaseDataResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refetch = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const dataRef = ref(database, path);

    const handleValue = (snapshot: DataSnapshot) => {
      try {
        const rawData = snapshot.val();
        const transformedData = transform ? transform(rawData) : rawData;
        setData(transformedData);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to process data'));
      } finally {
        setLoading(false);
      }
    };

    const handleError = (err: Error) => {
      console.error(`Firebase error at ${path}:`, err);
      setError(err);
      setLoading(false);
    };

    onValue(dataRef, handleValue, handleError);

    return () => {
      off(dataRef, 'value', handleValue);
    };
  }, [path, transform, enabled, refreshKey]);

  return { data, loading, error, refetch };
}

// Хук для списка с преобразованием в массив
export function useFirebaseList<T>({
  path,
  enabled = true,
}: Omit<UseFirebaseDataOptions<T[]>, 'transform'>): UseFirebaseDataResult<T[]> {
  const transform = useCallback((data: Record<string, any> | null): T[] => {
    if (!data) return [];
    return Object.entries(data).map(([id, value]) => ({
      id,
      ...value,
    })) as T[];
  }, []);

  return useFirebaseData<T[]>({ path, transform, enabled });
}

// Хук для проверки статуса expired
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

// Хук для проверки offline статуса
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
