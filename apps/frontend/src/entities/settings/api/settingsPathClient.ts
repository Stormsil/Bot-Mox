import {
  type ApiSuccessEnvelope,
  apiGet as sharedApiGet,
  apiPatch as sharedApiPatch,
  apiPut as sharedApiPut,
} from '../../../shared/api/apiClient';
import { assertFrontendWriteAccess } from '../../../shared/api/writeAccessGuard';

interface SettingsEnvelope<T> {
  data: T;
  meta?: Record<string, unknown>;
}

export const SETTINGS_API_BASE_PATH = '/api/v1/settings';
function toSettingsEnvelope<T>(response: ApiSuccessEnvelope<T>): SettingsEnvelope<T> {
  return {
    data: response.data,
    meta: response.meta,
  };
}

export const apiGet = async <T>(path: string): Promise<SettingsEnvelope<T>> => {
  return toSettingsEnvelope(await sharedApiGet<T>(path));
};

export const apiPatch = async <T>(path: string, payload: unknown): Promise<SettingsEnvelope<T>> => {
  assertFrontendWriteAccess(path);
  return toSettingsEnvelope(await sharedApiPatch<T>(path, payload));
};

export const apiPut = async <T>(path: string, payload: unknown): Promise<SettingsEnvelope<T>> => {
  assertFrontendWriteAccess(path);
  return toSettingsEnvelope(await sharedApiPut<T>(path, payload));
};

export const getSettingsPath = (path: string): string => {
  const normalized = String(path || '').trim();
  if (!normalized) {
    return SETTINGS_API_BASE_PATH;
  }

  const withoutLeadingSlash = normalized.replace(/^\/+/, '');
  if (withoutLeadingSlash.startsWith('api/v1/settings/')) {
    return `/${withoutLeadingSlash}`;
  }
  if (withoutLeadingSlash === 'api/v1/settings') {
    return SETTINGS_API_BASE_PATH;
  }

  return `${SETTINGS_API_BASE_PATH}/${withoutLeadingSlash}`;
};

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
