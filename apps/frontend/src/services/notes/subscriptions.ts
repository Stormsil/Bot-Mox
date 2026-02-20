import { uiLogger } from '../../observability/uiLogger';
import { createPollingSubscription } from '../apiClient';
import type { Unsubscribe } from './types';

interface SubscriptionOptions<T> {
  key: string;
  intervalMs: number;
  load: () => Promise<T>;
  callback: (value: T) => void;
  fallbackValue: T;
  errorMessage: string;
  immediate?: boolean;
}

export function createNotesPollingSubscription<T>({
  key,
  intervalMs,
  load,
  callback,
  fallbackValue,
  errorMessage,
  immediate = true,
}: SubscriptionOptions<T>): Unsubscribe {
  return createPollingSubscription(
    load,
    callback,
    (error) => {
      uiLogger.error(errorMessage, error);
      callback(fallbackValue);
    },
    { key, intervalMs, immediate },
  );
}
