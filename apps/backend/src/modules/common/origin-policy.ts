import type { IncomingHttpHeaders } from 'node:http';

const ADMIN_PROTECTED_PREFIXES = [
  '/api/v1/admin',
  '/api/v1/auth/admin',
  '/api/v1/billing/admin',
  '/api/v1/diag/runtime-metrics',
] as const;

function toHeaderString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return String(value[0] || '').trim();
  }
  return String(value || '').trim();
}

export function normalizeOrigin(value: string): string {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }

  try {
    const parsed = new URL(raw);
    return parsed.origin.toLowerCase();
  } catch {
    return '';
  }
}

export function parseAllowedOrigins(
  rawValue: string | undefined,
  fallbacks: string[],
): Set<string> {
  const raw = String(rawValue || '').trim();
  const source =
    raw.length > 0
      ? raw.split(',').map((entry) => entry.trim())
      : fallbacks.map((entry) => String(entry || '').trim());

  const set = new Set<string>();
  for (const candidate of source) {
    const normalized = normalizeOrigin(candidate);
    if (normalized) {
      set.add(normalized);
    }
  }
  return set;
}

export function extractRequestOrigin(headers: IncomingHttpHeaders): string {
  const origin = normalizeOrigin(toHeaderString(headers.origin));
  if (origin) {
    return origin;
  }

  const referer = toHeaderString(headers.referer);
  if (!referer) {
    return '';
  }

  try {
    return normalizeOrigin(new URL(referer).origin);
  } catch {
    return '';
  }
}

export function isAdminOriginProtectedPath(pathOrUrl: string): boolean {
  const raw = String(pathOrUrl || '').trim();
  if (!raw) {
    return false;
  }

  let pathname = raw;
  try {
    pathname = new URL(raw, 'http://localhost').pathname;
  } catch {
    pathname = raw.split('?')[0] || raw;
  }

  const normalizedPath = pathname.toLowerCase();
  return ADMIN_PROTECTED_PREFIXES.some(
    (prefix) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`),
  );
}
