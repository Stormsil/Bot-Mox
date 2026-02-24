import { normalizePathForRules } from './requestQueue';
import type { ApiSuccessEnvelope } from './types';

interface CachedGetEntry {
  expiresAt: number;
  value: ApiSuccessEnvelope<unknown>;
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

export function clearGetCache(): void {
  GET_CACHE.clear();
  GET_INFLIGHT.clear();
}

export function getCachedGet<T>(path: string): ApiSuccessEnvelope<T> | null {
  const key = getGetCacheKey(path);
  const cached = GET_CACHE.get(key);
  if (!cached || cached.expiresAt <= Date.now()) {
    return null;
  }
  return cached.value as ApiSuccessEnvelope<T>;
}

export function getInFlightGet<T>(path: string): Promise<ApiSuccessEnvelope<T>> | null {
  const key = getGetCacheKey(path);
  const inFlight = GET_INFLIGHT.get(key);
  return inFlight ? (inFlight as Promise<ApiSuccessEnvelope<T>>) : null;
}

export function setInFlightGet<T>(path: string, value: Promise<ApiSuccessEnvelope<T>>): void {
  const key = getGetCacheKey(path);
  GET_INFLIGHT.set(key, value as Promise<ApiSuccessEnvelope<unknown>>);
}

export function clearInFlightGet(path: string): void {
  const key = getGetCacheKey(path);
  GET_INFLIGHT.delete(key);
}

export function setCachedGet(path: string, result: ApiSuccessEnvelope<unknown>): void {
  const key = getGetCacheKey(path);
  const ttlMs = getGetCacheTtlMs(path);
  GET_CACHE.set(key, {
    expiresAt: Date.now() + ttlMs,
    value: result,
  });
}
