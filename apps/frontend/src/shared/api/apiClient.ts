import { buildApiUrl } from '../../config/env';
import { authFetch } from './authFetch';
import { ApiClientError, type ApiSuccessEnvelope, parseEnvelope } from './internal/types';

export type { ApiSuccessEnvelope } from './internal/types';
export { ApiClientError } from './internal/types';

function resolveRequestUrl(path: string): string {
  const normalized = String(path || '').trim();
  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }
  return buildApiUrl(normalized);
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

  if (method !== 'GET') {
    return performRequest<T>(path, init);
  }

  return performRequest<T>(path, {
    ...init,
    method: 'GET',
  });
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
