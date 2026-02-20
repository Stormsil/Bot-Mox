import { apiGet } from '../apiClient';
import { SETTINGS_API_PREFIX } from './constants';

export function normalizeApiPath(path: string): string {
  const normalized = String(path || '')
    .trim()
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
  if (!normalized) {
    return SETTINGS_API_PREFIX;
  }
  return `${SETTINGS_API_PREFIX}/${normalized}`;
}

export async function readSettingsPath<T>(path: string): Promise<T | undefined> {
  const response = await apiGet<T>(normalizeApiPath(path));
  return response.data;
}
