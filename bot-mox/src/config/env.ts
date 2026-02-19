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
    return `${window.location.protocol}//${window.location.hostname}:3001`;
  }

  return 'http://localhost:3001';
}

function resolveDefaultWsBaseUrl(apiBaseUrl: string): string {
  if (apiBaseUrl.startsWith('https://')) {
    return `wss://${apiBaseUrl.slice('https://'.length)}`;
  }
  if (apiBaseUrl.startsWith('http://')) {
    return `ws://${apiBaseUrl.slice('http://'.length)}`;
  }

  if (typeof window !== 'undefined' && window.location) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}`;
  }

  return 'ws://localhost:3001';
}

export const API_BASE_URL = trimTrailingSlash(
  String(
    readRuntimeString(getRuntimeConfig().apiBaseUrl) ||
      import.meta.env.VITE_API_BASE_URL ||
      import.meta.env.VITE_PROXY_BASE_URL ||
      resolveDefaultApiBaseUrl(),
  ).trim(),
);

export const WS_BASE_URL = trimTrailingSlash(
  String(
    readRuntimeString(getRuntimeConfig().wsBaseUrl) ||
      import.meta.env.VITE_WS_BASE_URL ||
      resolveDefaultWsBaseUrl(API_BASE_URL),
  ).trim(),
);

export function buildApiUrl(path: string): string {
  const normalizedPath = ensureLeadingSlash(trimLeadingSlash(String(path || '').trim()));
  if (!API_BASE_URL) return normalizedPath;
  return `${API_BASE_URL}${normalizedPath}`;
}

export function buildWsUrl(path: string): string {
  const normalizedPath = ensureLeadingSlash(trimLeadingSlash(String(path || '').trim()));
  return `${WS_BASE_URL}${normalizedPath}`;
}

export function buildProxyUiUrl(path: string): string {
  const raw = String(path || '').trim();
  if (!raw) return API_BASE_URL || '';

  const normalizedPath = ensureLeadingSlash(trimLeadingSlash(raw));
  if (!API_BASE_URL) return normalizedPath;
  return `${API_BASE_URL}${normalizedPath}`;
}
