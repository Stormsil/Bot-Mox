import { buildApiUrl } from '../config/env';
import { authFetch } from './authFetch';

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

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<ApiSuccessEnvelope<T>> {
  const response = await authFetch(buildApiUrl(path), {
    ...init,
  });

  const envelope = await parseEnvelope<T>(response);

  if (!response.ok || !envelope.success) {
    const message = envelope.success ? `HTTP ${response.status}` : String(envelope.error?.message || `HTTP ${response.status}`);
    const code = envelope.success ? 'HTTP_ERROR' : String(envelope.error?.code || 'API_ERROR');
    const details = envelope.success ? undefined : envelope.error?.details;
    throw new ApiClientError(message, {
      status: response.status,
      code,
      details,
    });
  }

  return envelope;
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
}

export function createPollingSubscription<T>(
  loader: () => Promise<T>,
  onData: (data: T) => void,
  onError?: (error: Error) => void,
  options: PollingOptions = {}
): () => void {
  const intervalMs = Number(options.intervalMs || 5000);
  const immediate = options.immediate !== false;

  let isActive = true;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let isInFlight = false;

  const scheduleNext = () => {
    if (!isActive) return;
    timer = setTimeout(run, intervalMs);
  };

  const run = async () => {
    if (!isActive || isInFlight) {
      return;
    }

    isInFlight = true;

    try {
      const payload = await loader();
      if (isActive) {
        onData(payload);
      }
    } catch (error) {
      if (isActive) {
        onError?.(toError(error));
      }
    } finally {
      isInFlight = false;
      scheduleNext();
    }
  };

  if (immediate) {
    void run();
  } else {
    scheduleNext();
  }

  return () => {
    isActive = false;
    if (timer) {
      clearTimeout(timer);
    }
  };
}
