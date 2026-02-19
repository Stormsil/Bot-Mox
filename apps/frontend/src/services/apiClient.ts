import { buildApiUrl } from '../config/env';
import { authFetch } from './authFetch';

export { createPollingSubscription } from './apiClient/polling';

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
  {
    pattern: /^\/api\/v1\/workspace\/notes(?:\/|\?|$)/,
    getMinSpacingMs: 150,
    mutationMinSpacingMs: 45,
  },
  {
    pattern: /^\/api\/v1\/settings\/projects(?:\/|\?|$)/,
    getMinSpacingMs: 135,
    mutationMinSpacingMs: 40,
  },
  {
    pattern: /^\/api\/v1\/settings\/vmgenerator(?:\/|\?|$)/,
    getMinSpacingMs: 130,
    mutationMinSpacingMs: 35,
  },
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
  requestQueueTimer = setTimeout(
    () => {
      requestQueueTimer = null;
      drainRequestQueue();
    },
    Math.max(0, delayMs),
  );
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

  item
    .run()
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
      }),
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
    const message = envelope.success
      ? `HTTP ${response.status}`
      : String(envelope.error?.message || `HTTP ${response.status}`);
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

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<ApiSuccessEnvelope<T>> {
  const method = String(init.method || 'GET')
    .trim()
    .toUpperCase();
  const qos = resolveRequestQos(path, method);

  if (method !== 'GET') {
    const result = await enqueueRequest(() => performRequest<T>(path, init), qos);
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
    qos,
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
  params: Record<string, string | number | boolean | null | undefined>,
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
