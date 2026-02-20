import { buildApiUrl } from '../../config/env';
import { ApiClientError } from './types';

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

export function normalizePathForRules(path: string): string {
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

export function resolveRequestUrl(path: string): string {
  const normalized = String(path || '').trim();
  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }
  return buildApiUrl(normalized);
}

export function resolveRequestQos(path: string, method: string): RequestQos {
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

export function enqueueRequest<T>(run: () => Promise<T>, qos: RequestQos): Promise<T> {
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
