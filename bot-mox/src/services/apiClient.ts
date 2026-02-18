import { buildApiUrl } from '../config/env';
import { authFetch } from './authFetch';
import { uiLogger } from '../observability/uiLogger'

export interface ApiSuccessEnvelope<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

interface ApiFailureEnvelope {
  success: false;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

type ApiEnvelope<T> = ApiSuccessEnvelope<T> | ApiFailureEnvelope;

export class ApiClientError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(message: string, options?: { status?: number; code?: string; details?: unknown }) {
    super(message);
    this.name = 'ApiClientError';
    this.status = Number(options?.status || 500);
    this.code = String(options?.code || 'API_ERROR');
    this.details = options?.details;
  }
}

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error('Unknown error');
}

function hasContentType(response: Response, expected: string): boolean {
  const contentType = response.headers.get('content-type') || '';
  return contentType.toLowerCase().includes(expected.toLowerCase());
}

async function parseEnvelope<T>(response: Response): Promise<ApiEnvelope<T>> {
  if (!hasContentType(response, 'application/json')) {
    if (response.ok) {
      return { success: true, data: undefined as T };
    }

    throw new ApiClientError(`HTTP ${response.status}`, {
      status: response.status,
      code: 'HTTP_ERROR',
    });
  }

  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!payload || typeof payload !== 'object') {
    throw new ApiClientError('Invalid API response payload', {
      status: response.status,
      code: 'INVALID_RESPONSE',
    });
  }

  return payload;
}

interface CachedGetEntry {
  expiresAt: number;
  value: ApiSuccessEnvelope<unknown>;
}

interface RequestQos {
  minSpacingMs: number;
  priority: number;
}

interface RequestQosRule {
  pattern: RegExp;
  getMinSpacingMs?: number;
  mutationMinSpacingMs?: number;
}

interface QueuedRequest<T> {
  id: number;
  priority: number;
  minSpacingMs: number;
  run: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

const GET_CACHE = new Map<string, CachedGetEntry>();
const GET_INFLIGHT = new Map<string, Promise<ApiSuccessEnvelope<unknown>>>();
const DEFAULT_GET_CACHE_TTL_MS = 750;
const GET_CACHE_RULES: Array<{ pattern: RegExp; ttlMs: number }> = [
  { pattern: /^\/api\/v1\/auth\/verify(?:\?|$)/, ttlMs: 5000 },
  { pattern: /^\/api\/v1\/settings\/theme(?:\?|$)/, ttlMs: 5000 },
  { pattern: /^\/api\/v1\/settings\/projects(?:\?|$)/, ttlMs: 3000 },
  { pattern: /^\/api\/v1\/bots(?:\/|\?|$)/, ttlMs: 2000 },
  { pattern: /^\/api\/v1\/resources\/(?:licenses|proxies|subscriptions)(?:\?|$)/, ttlMs: 2000 },
  { pattern: /^\/api\/v1\/finance\/operations(?:\?|$)/, ttlMs: 1500 },
];

const DEFAULT_GET_REQUEST_SPACING_MS = 120;
const DEFAULT_MUTATION_REQUEST_SPACING_MS = 35;
const REQUEST_MAX_CONCURRENCY = 6;
const REQUEST_MAX_QUEUE_SIZE = 400;
const REQUEST_QOS_RULES: RequestQosRule[] = [
  { pattern: /^\/api\/v1\/bots(?:\/|\?|$)/, getMinSpacingMs: 140, mutationMinSpacingMs: 45 },
  { pattern: /^\/api\/v1\/workspace\/notes(?:\/|\?|$)/, getMinSpacingMs: 150, mutationMinSpacingMs: 45 },
  { pattern: /^\/api\/v1\/settings\/projects(?:\/|\?|$)/, getMinSpacingMs: 135, mutationMinSpacingMs: 40 },
  { pattern: /^\/api\/v1\/settings\/vmgenerator(?:\/|\?|$)/, getMinSpacingMs: 130, mutationMinSpacingMs: 35 },
];

const REQUEST_QUEUE: QueuedRequest<unknown>[] = [];
let requestQueueTimer: ReturnType<typeof setTimeout> | null = null;
let nextQueuedRequestId = 1;
let activeRequestCount = 0;
let lastRequestDispatchAt = 0;

function normalizePathForRules(path: string): string {
  const raw = String(path || '').trim();
  if (!raw) return '/';

  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      return `${parsed.pathname || '/'}${parsed.search || ''}`;
    } catch {
      return raw;
    }
  }

  return raw.startsWith('/') ? raw : `/${raw}`;
}

function resolveRequestUrl(path: string): string {
  const normalized = String(path || '').trim();
  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }
  return buildApiUrl(normalized);
}

function resolveRequestQos(path: string, method: string): RequestQos {
  const normalizedPath = normalizePathForRules(path);
  const upperMethod = String(method || 'GET').toUpperCase();
  const isMutation = upperMethod !== 'GET';
  const rule = REQUEST_QOS_RULES.find((item) => item.pattern.test(normalizedPath));
  const minSpacingMs = isMutation
    ? Number(rule?.mutationMinSpacingMs ?? DEFAULT_MUTATION_REQUEST_SPACING_MS)
    : Number(rule?.getMinSpacingMs ?? DEFAULT_GET_REQUEST_SPACING_MS);

  return {
    minSpacingMs: Math.max(0, Math.trunc(minSpacingMs)),
    priority: isMutation ? 10 : 0,
  };
}

function scheduleQueueDrain(delayMs = 0): void {
  if (requestQueueTimer) return;
  requestQueueTimer = setTimeout(() => {
    requestQueueTimer = null;
    drainRequestQueue();
  }, Math.max(0, delayMs));
}

function dequeueNextRequest(): QueuedRequest<unknown> | null {
  if (REQUEST_QUEUE.length === 0) {
    return null;
  }

  REQUEST_QUEUE.sort((a, b) => {
    if (a.priority !== b.priority) {
      return b.priority - a.priority;
    }
    return a.id - b.id;
  });

  return REQUEST_QUEUE.shift() || null;
}

function dispatchQueuedRequest(item: QueuedRequest<unknown>): void {
  activeRequestCount += 1;
  lastRequestDispatchAt = Date.now();

  item.run()
    .then((value) => {
      item.resolve(value);
    })
    .catch((error) => {
      item.reject(error);
    })
    .finally(() => {
      activeRequestCount = Math.max(0, activeRequestCount - 1);
      drainRequestQueue();
    });
}

function drainRequestQueue(): void {
  if (activeRequestCount >= REQUEST_MAX_CONCURRENCY) {
    return;
  }

  const next = dequeueNextRequest();
  if (!next) {
    return;
  }

  const elapsed = Date.now() - lastRequestDispatchAt;
  const waitMs = Math.max(0, next.minSpacingMs - elapsed);
  if (waitMs > 0) {
    REQUEST_QUEUE.unshift(next);
    scheduleQueueDrain(waitMs);
    return;
  }

  dispatchQueuedRequest(next);

  if (activeRequestCount < REQUEST_MAX_CONCURRENCY && REQUEST_QUEUE.length > 0) {
    drainRequestQueue();
  }
}

function enqueueRequest<T>(run: () => Promise<T>, qos: RequestQos): Promise<T> {
  if (REQUEST_QUEUE.length >= REQUEST_MAX_QUEUE_SIZE) {
    return Promise.reject(
      new ApiClientError('Request queue overloaded. Please retry shortly.', {
        status: 429,
        code: 'CLIENT_QUEUE_OVERLOAD',
      })
    );
  }

  return new Promise<T>((resolve, reject) => {
    REQUEST_QUEUE.push({
      id: nextQueuedRequestId++,
      priority: qos.priority,
      minSpacingMs: qos.minSpacingMs,
      run,
      resolve,
      reject,
    } as QueuedRequest<unknown>);

    drainRequestQueue();
  });
}

function getAuthCacheScope(): string {
  if (typeof window === 'undefined') return 'no-window';
  try {
    const token = String(localStorage.getItem('botmox.auth.token') || '');
    if (!token) return 'anonymous';
    return token.slice(0, 24);
  } catch {
    return 'anonymous';
  }
}

function getGetCacheKey(path: string): string {
  return `${getAuthCacheScope()}::${path}`;
}

function getGetCacheTtlMs(path: string): number {
  const normalized = normalizePathForRules(path);
  const rule = GET_CACHE_RULES.find((item) => item.pattern.test(normalized));
  return rule?.ttlMs ?? DEFAULT_GET_CACHE_TTL_MS;
}

function clearGetCache(): void {
  GET_CACHE.clear();
  GET_INFLIGHT.clear();
}

async function performRequest<T>(path: string, init: RequestInit): Promise<ApiSuccessEnvelope<T>> {
  const response = await authFetch(resolveRequestUrl(path), {
    ...init,
  });

  const envelope = await parseEnvelope<T>(response);
  const traceId = response.headers.get('x-trace-id');
  const spanId = response.headers.get('x-span-id');
  const correlationId = response.headers.get('x-correlation-id');

  if (!response.ok || !envelope.success) {
    const message = envelope.success ? `HTTP ${response.status}` : String(envelope.error?.message || `HTTP ${response.status}`);
    const code = envelope.success ? 'HTTP_ERROR' : String(envelope.error?.code || 'API_ERROR');
    const baseDetails = envelope.success ? undefined : envelope.error?.details;
    const debug = {
      trace_id: traceId || null,
      span_id: spanId || null,
      correlation_id: correlationId || null,
      status: response.status,
      path,
      method: String(init.method || 'GET').toUpperCase(),
    };
    const details = envelope.success
      ? undefined
      : typeof baseDetails === 'object' && baseDetails !== null && !Array.isArray(baseDetails)
        ? { ...baseDetails, debug }
        : { details: baseDetails, debug };
    throw new ApiClientError(message, {
      status: response.status,
      code,
      details,
    });
  }

  return envelope;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<ApiSuccessEnvelope<T>> {
  const method = String(init.method || 'GET').trim().toUpperCase();
  const qos = resolveRequestQos(path, method);

  if (method !== 'GET') {
    const result = await enqueueRequest(
      () => performRequest<T>(path, init),
      qos
    );
    clearGetCache();
    return result;
  }

  const key = getGetCacheKey(path);
  const now = Date.now();
  const cached = GET_CACHE.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.value as ApiSuccessEnvelope<T>;
  }

  const inFlight = GET_INFLIGHT.get(key);
  if (inFlight) {
    return inFlight as Promise<ApiSuccessEnvelope<T>>;
  }

  const requestPromise = enqueueRequest(
    () =>
      performRequest<T>(path, {
        ...init,
        method: 'GET',
      }),
    qos
  )
    .then((result) => {
      const ttlMs = getGetCacheTtlMs(path);
      GET_CACHE.set(key, {
        expiresAt: Date.now() + ttlMs,
        value: result as ApiSuccessEnvelope<unknown>,
      });
      return result;
    })
    .finally(() => {
      GET_INFLIGHT.delete(key);
    });

  GET_INFLIGHT.set(key, requestPromise as Promise<ApiSuccessEnvelope<unknown>>);
  return requestPromise;
}

export function buildQueryString(
  params: Record<string, string | number | boolean | null | undefined>
): string {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    search.set(key, String(value));
  });

  const query = search.toString();
  return query ? `?${query}` : '';
}

export async function apiGet<T>(path: string): Promise<ApiSuccessEnvelope<T>> {
  return apiRequest<T>(path, {
    method: 'GET',
  });
}

export async function apiPost<T>(path: string, payload: unknown): Promise<ApiSuccessEnvelope<T>> {
  return apiRequest<T>(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload ?? {}),
  });
}

export async function apiPatch<T>(path: string, payload: unknown): Promise<ApiSuccessEnvelope<T>> {
  return apiRequest<T>(path, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload ?? {}),
  });
}

export async function apiPut<T>(path: string, payload: unknown): Promise<ApiSuccessEnvelope<T>> {
  return apiRequest<T>(path, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload ?? {}),
  });
}

export async function apiDelete<T>(path: string): Promise<ApiSuccessEnvelope<T>> {
  return apiRequest<T>(path, {
    method: 'DELETE',
  });
}

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
    ...Array.from(channel.subscribers.values()).map((subscriber) => subscriber.maxAdaptiveIntervalMs)
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
    ...Array.from(channel.subscribers.values()).map((subscriber) => subscriber.maxErrorBackoffMs)
  );
  const expFactor = Math.min(channel.consecutiveErrors, 6);
  const backoffBase = channel.consecutiveErrors > 0
    ? Math.min(adaptiveBaseInterval * (2 ** expFactor), maxErrorBackoffMs)
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
  options: PollingOptions = {}
): () => void {
  ensureVisibilityListener();

  const intervalMs = clampPollingInterval(options.intervalMs, DEFAULT_POLL_INTERVAL_MS);
  const hiddenIntervalMs = clampPollingInterval(
    options.hiddenIntervalMs,
    intervalMs * DEFAULT_HIDDEN_MULTIPLIER
  );
  const maxErrorBackoffMs = clampPollingInterval(
    options.maxErrorBackoffMs,
    DEFAULT_MAX_ERROR_BACKOFF_MS
  );
  const maxAdaptiveIntervalMs = clampPollingInterval(
    options.maxAdaptiveIntervalMs,
    DEFAULT_MAX_ADAPTIVE_INTERVAL_MS
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
