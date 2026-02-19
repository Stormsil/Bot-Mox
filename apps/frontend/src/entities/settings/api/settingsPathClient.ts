import { buildApiUrl } from '../../../config/env';

const AUTH_TOKEN_KEY = 'botmox.auth.token';

interface SettingsEnvelope<T> {
  data: T;
  meta?: Record<string, unknown>;
}

function getAuthToken(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  try {
    return String(localStorage.getItem(AUTH_TOKEN_KEY) || '').trim();
  } catch {
    return '';
  }
}

function withAuthHeaders(headers?: HeadersInit): Headers {
  const merged = new Headers(headers || {});
  const token = getAuthToken();

  if (token && !merged.has('Authorization')) {
    merged.set('Authorization', `Bearer ${token}`);
  }

  if (!merged.has('Accept')) {
    merged.set('Accept', 'application/json');
  }

  return merged;
}

async function parseJsonSafe(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return null;
  }

  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normalizeEnvelope<T>(payload: unknown): SettingsEnvelope<T> {
  if (payload && typeof payload === 'object' && 'data' in (payload as Record<string, unknown>)) {
    return payload as SettingsEnvelope<T>;
  }

  return {
    data: payload as T,
  };
}

async function requestSettings<T>(
  method: 'GET' | 'PATCH' | 'PUT',
  path: string,
  payload?: unknown,
): Promise<SettingsEnvelope<T>> {
  const response = await fetch(buildApiUrl(getSettingsPath(path)), {
    method,
    cache: 'no-store',
    headers: withAuthHeaders(
      payload === undefined
        ? undefined
        : {
            'Content-Type': 'application/json',
          },
    ),
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });

  const body = await parseJsonSafe(response);
  if (!response.ok) {
    const message =
      body && typeof body === 'object'
        ? String((body as { error?: { message?: string } }).error?.message || '')
        : '';
    throw new Error(message || `Settings request failed (${response.status})`);
  }

  return normalizeEnvelope<T>(body);
}

export const apiGet = <T>(path: string): Promise<SettingsEnvelope<T>> => {
  return requestSettings<T>('GET', path);
};

export const apiPatch = <T>(path: string, payload: unknown): Promise<SettingsEnvelope<T>> => {
  return requestSettings<T>('PATCH', path, payload);
};

export const apiPut = <T>(path: string, payload: unknown): Promise<SettingsEnvelope<T>> => {
  return requestSettings<T>('PUT', path, payload);
};

export const getSettingsPath = (path: string): string => `/api/v1/settings/${path}`;

export const readSettingsPath = async <T>(path: string): Promise<T | null> => {
  const response = await apiGet<unknown>(getSettingsPath(path));
  return (response.data as T) ?? null;
};

export const writeSettingsPath = async (path: string, payload: unknown): Promise<void> => {
  await apiPut(getSettingsPath(path), payload);
};

export const patchSettingsPath = async (path: string, payload: unknown): Promise<void> => {
  await apiPatch(getSettingsPath(path), payload);
};
