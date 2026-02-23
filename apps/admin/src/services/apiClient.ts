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

async function parseEnvelope<T>(response: Response): Promise<ApiEnvelope<T>> {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    if (response.ok) return { success: true, data: undefined as T };
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

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<ApiSuccessEnvelope<T>> {
  const normalized = String(path || '').trim();
  const url = /^https?:\/\//i.test(normalized) ? normalized : buildApiUrl(normalized);
  const response = await authFetch(url, init);
  const envelope = await parseEnvelope<T>(response);

  if (!response.ok || !envelope.success) {
    const message = envelope.success
      ? `HTTP ${response.status}`
      : String(envelope.error?.message || `HTTP ${response.status}`);
    const code = envelope.success ? 'HTTP_ERROR' : String(envelope.error?.code || 'API_ERROR');
    throw new ApiClientError(message, {
      status: response.status,
      code,
      details: envelope.success ? undefined : envelope.error?.details,
    });
  }

  return envelope;
}

export async function apiPost<T>(path: string, payload: unknown): Promise<ApiSuccessEnvelope<T>> {
  return apiRequest<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload ?? {}),
  });
}
