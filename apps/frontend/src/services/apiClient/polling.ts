import { uiLogger } from '../../observability/uiLogger';

interface PollingOptions {
  intervalMs?: number;
  immediate?: boolean;
  key?: string;
  shared?: boolean;
  hiddenIntervalMs?: number;
  maxErrorBackoffMs?: number;
  adaptive?: boolean;
  maxAdaptiveIntervalMs?: number;
}

const DEFAULT_POLL_INTERVAL_MS = 5000;
const MIN_POLL_INTERVAL_MS = 500;
const MAX_POLL_INTERVAL_MS = 120000;
const DEFAULT_HIDDEN_MULTIPLIER = 3;
const DEFAULT_MAX_ERROR_BACKOFF_MS = 120000;
const DEFAULT_MAX_ADAPTIVE_INTERVAL_MS = 30000;
const MAX_ADAPTIVE_STABLE_MULTIPLIER = 6;
const POLL_JITTER_RATIO = 0.12;

interface PollingSubscriber<T> {
  id: number;
  onData: (data: T) => void;
  onError?: (error: Error) => void;
  intervalMs: number;
  hiddenIntervalMs: number;
  maxErrorBackoffMs: number;
  adaptive: boolean;
  maxAdaptiveIntervalMs: number;
}

interface PollingChannel<T> {
  key: string;
  loader: () => Promise<T>;
  subscribers: Map<number, PollingSubscriber<T>>;
  timer: ReturnType<typeof setTimeout> | null;
  isInFlight: boolean;
  consecutiveErrors: number;
  hasLatestData: boolean;
  latestData: T | undefined;
  stableSuccessCount: number;
  latestPayloadSignature?: string;
}

const POLLING_CHANNELS = new Map<string, PollingChannel<unknown>>();
const LOADER_KEYS = new WeakMap<(...args: unknown[]) => unknown, string>();
let nextChannelId = 1;
let nextSubscriberId = 1;
let visibilityListenerBound = false;

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error('Unknown error');
}

function clampPollingInterval(rawValue: number | undefined, fallback: number): number {
  const value = Number(rawValue);
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.min(MAX_POLL_INTERVAL_MS, Math.max(MIN_POLL_INTERVAL_MS, Math.trunc(value)));
}

function resolvePollingKey<T>(loader: () => Promise<T>, options: PollingOptions): string {
  if (options.shared === false) {
    return `private:${nextChannelId++}`;
  }

  const explicit = String(options.key || '').trim();
  if (explicit) {
    return `key:${explicit}`;
  }

  const existing = LOADER_KEYS.get(loader);
  if (existing) {
    return existing;
  }

  const generated = `loader:${nextChannelId++}`;
  LOADER_KEYS.set(loader, generated);
  return generated;
}

function getActivePollingInterval(channel: PollingChannel<unknown>): number {
  const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
  let minInterval = MAX_POLL_INTERVAL_MS;

  for (const subscriber of channel.subscribers.values()) {
    const candidate = hidden ? subscriber.hiddenIntervalMs : subscriber.intervalMs;
    if (candidate < minInterval) {
      minInterval = candidate;
    }
  }

  return Math.min(MAX_POLL_INTERVAL_MS, Math.max(MIN_POLL_INTERVAL_MS, minInterval));
}

function canUseAdaptiveCadence(channel: PollingChannel<unknown>): boolean {
  if (channel.subscribers.size === 0) {
    return false;
  }
  return Array.from(channel.subscribers.values()).every((subscriber) => subscriber.adaptive);
}

function getAdaptiveIntervalCap(channel: PollingChannel<unknown>): number {
  if (channel.subscribers.size === 0) {
    return DEFAULT_MAX_ADAPTIVE_INTERVAL_MS;
  }
  return Math.min(
    ...Array.from(channel.subscribers.values()).map(
      (subscriber) => subscriber.maxAdaptiveIntervalMs,
    ),
  );
}

function getPayloadSignature(payload: unknown): string {
  try {
    const serialized = JSON.stringify(payload);
    if (typeof serialized === 'string') {
      return serialized;
    }
  } catch {
    // ignore and use fallback below
  }

  return String(payload);
}

function getAdaptiveBaseIntervalMs(channel: PollingChannel<unknown>, baseInterval: number): number {
  if (!canUseAdaptiveCadence(channel) || channel.consecutiveErrors > 0) {
    return baseInterval;
  }

  const stableTier = Math.floor(channel.stableSuccessCount / 2);
  const multiplier = Math.min(MAX_ADAPTIVE_STABLE_MULTIPLIER, 1 + stableTier);
  const capped = Math.min(baseInterval * multiplier, getAdaptiveIntervalCap(channel));
  return Math.max(MIN_POLL_INTERVAL_MS, Math.trunc(capped));
}

function getEffectiveDelayMs(channel: PollingChannel<unknown>): number {
  const baseInterval = getActivePollingInterval(channel);
  const adaptiveBaseInterval = getAdaptiveBaseIntervalMs(channel, baseInterval);
  const maxErrorBackoffMs = Math.min(
    ...Array.from(channel.subscribers.values()).map((subscriber) => subscriber.maxErrorBackoffMs),
  );
  const expFactor = Math.min(channel.consecutiveErrors, 6);
  const backoffBase =
    channel.consecutiveErrors > 0
      ? Math.min(adaptiveBaseInterval * 2 ** expFactor, maxErrorBackoffMs)
      : adaptiveBaseInterval;
  const jitter = Math.trunc(backoffBase * POLL_JITTER_RATIO * Math.random());
  return backoffBase + jitter;
}

function clearPollingTimer(channel: PollingChannel<unknown>): void {
  if (!channel.timer) return;
  clearTimeout(channel.timer);
  channel.timer = null;
}

function schedulePollingRun(channel: PollingChannel<unknown>): void {
  if (channel.subscribers.size === 0) return;
  clearPollingTimer(channel);
  const delayMs = getEffectiveDelayMs(channel);
  channel.timer = setTimeout(() => {
    void runPollingChannel(channel);
  }, delayMs);
}

async function runPollingChannel(channel: PollingChannel<unknown>): Promise<void> {
  if (channel.isInFlight || channel.subscribers.size === 0) {
    return;
  }

  channel.isInFlight = true;

  try {
    const payload = await channel.loader();
    const signature = getPayloadSignature(payload);
    if (channel.latestPayloadSignature === signature) {
      channel.stableSuccessCount += 1;
    } else {
      channel.stableSuccessCount = 0;
      channel.latestPayloadSignature = signature;
    }
    channel.latestData = payload;
    channel.hasLatestData = true;
    channel.consecutiveErrors = 0;

    for (const subscriber of channel.subscribers.values()) {
      try {
        subscriber.onData(payload);
      } catch (callbackError) {
        uiLogger.error('Polling subscriber onData failed:', callbackError);
      }
    }
  } catch (error) {
    channel.consecutiveErrors += 1;
    channel.stableSuccessCount = 0;
    const normalizedError = toError(error);
    for (const subscriber of channel.subscribers.values()) {
      try {
        subscriber.onError?.(normalizedError);
      } catch (callbackError) {
        uiLogger.error('Polling subscriber onError failed:', callbackError);
      }
    }
  } finally {
    channel.isInFlight = false;
    schedulePollingRun(channel);
  }
}

function reflowPollingOnVisibilityChange(): void {
  for (const channel of POLLING_CHANNELS.values()) {
    if (channel.subscribers.size === 0) continue;
    schedulePollingRun(channel);
  }
}

function ensureVisibilityListener(): void {
  if (visibilityListenerBound || typeof document === 'undefined') return;
  document.addEventListener('visibilitychange', reflowPollingOnVisibilityChange);
  visibilityListenerBound = true;
}

export function createPollingSubscription<T>(
  loader: () => Promise<T>,
  onData: (data: T) => void,
  onError?: (error: Error) => void,
  options: PollingOptions = {},
): () => void {
  ensureVisibilityListener();

  const intervalMs = clampPollingInterval(options.intervalMs, DEFAULT_POLL_INTERVAL_MS);
  const hiddenIntervalMs = clampPollingInterval(
    options.hiddenIntervalMs,
    intervalMs * DEFAULT_HIDDEN_MULTIPLIER,
  );
  const maxErrorBackoffMs = clampPollingInterval(
    options.maxErrorBackoffMs,
    DEFAULT_MAX_ERROR_BACKOFF_MS,
  );
  const maxAdaptiveIntervalMs = clampPollingInterval(
    options.maxAdaptiveIntervalMs,
    DEFAULT_MAX_ADAPTIVE_INTERVAL_MS,
  );
  const immediate = options.immediate !== false;
  const adaptive = options.adaptive !== false;
  const key = resolvePollingKey(loader, options);
  const subscriberId = nextSubscriberId++;

  const existing = POLLING_CHANNELS.get(key) as PollingChannel<T> | undefined;
  const channel: PollingChannel<T> = existing ?? {
    key,
    loader,
    subscribers: new Map<number, PollingSubscriber<T>>(),
    timer: null,
    isInFlight: false,
    consecutiveErrors: 0,
    hasLatestData: false,
    latestData: undefined,
    stableSuccessCount: 0,
    latestPayloadSignature: undefined,
  };

  if (!existing) {
    POLLING_CHANNELS.set(key, channel as PollingChannel<unknown>);
  }

  channel.loader = loader;

  channel.subscribers.set(subscriberId, {
    id: subscriberId,
    onData,
    onError,
    intervalMs,
    hiddenIntervalMs,
    maxErrorBackoffMs,
    adaptive,
    maxAdaptiveIntervalMs,
  });

  if (channel.hasLatestData) {
    try {
      onData(channel.latestData as T);
    } catch (callbackError) {
      uiLogger.error('Polling subscriber immediate onData failed:', callbackError);
    }
    schedulePollingRun(channel as PollingChannel<unknown>);
  } else if (immediate) {
    void runPollingChannel(channel as PollingChannel<unknown>);
  } else {
    schedulePollingRun(channel as PollingChannel<unknown>);
  }

  return () => {
    const activeChannel = POLLING_CHANNELS.get(key) as PollingChannel<T> | undefined;
    if (!activeChannel) return;

    activeChannel.subscribers.delete(subscriberId);

    if (activeChannel.subscribers.size === 0) {
      clearPollingTimer(activeChannel as PollingChannel<unknown>);
      POLLING_CHANNELS.delete(key);
      return;
    }

    schedulePollingRun(activeChannel as PollingChannel<unknown>);
  };
}
