import { getRuntimeConfig, readRuntimeString } from './runtime-config';

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function trimLeadingSlash(value: string): string {
  return value.replace(/^\/+/, '');
}

function ensureLeadingSlash(value: string): string {
  return value.startsWith('/') ? value : `/${value}`;
}

function resolveDefaultApiBaseUrl(): string {
  if (!import.meta.env.DEV) return '';
  if (typeof window !== 'undefined' && window.location?.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:3002`;
  }
  return 'http://localhost:3002';
}

export const API_BASE_URL = trimTrailingSlash(
  String(
    readRuntimeString(getRuntimeConfig().apiBaseUrl) ||
      import.meta.env.VITE_API_BASE_URL ||
      resolveDefaultApiBaseUrl(),
  ).trim(),
);

export function buildApiUrl(path: string): string {
  const normalizedPath = ensureLeadingSlash(trimLeadingSlash(String(path || '').trim()));
  if (!API_BASE_URL) return normalizedPath;
  return `${API_BASE_URL}${normalizedPath}`;
}
