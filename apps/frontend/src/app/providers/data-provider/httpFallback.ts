import { SETTINGS_API_BASE_PATH } from '../../../entities/settings/api/settingsPathClient';
import { ApiClientError, type ApiSuccessEnvelope, apiRequest } from '../../../shared/api/apiClient';

const BLOCKED_MIGRATED_PREFIXES = [SETTINGS_API_BASE_PATH, '/api/v1/vm-ops', '/api/v1/vms'];

function normalizePath(path: string): string {
  const raw = String(path || '').trim();
  if (!raw) {
    return '/';
  }

  const [pathname] = raw.split(/[?#]/, 1);
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return normalized.replace(/\/+$/, '') || '/';
}

function resolveBlockedPrefix(path: string): string | null {
  const normalizedPath = normalizePath(path);
  for (const prefix of BLOCKED_MIGRATED_PREFIXES) {
    if (normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`)) {
      return prefix;
    }
  }
  return null;
}

export async function requestHttpFallback<T>(
  path: string,
  init: RequestInit = {},
): Promise<ApiSuccessEnvelope<T>> {
  const blockedPrefix = resolveBlockedPrefix(path);
  if (blockedPrefix) {
    throw new ApiClientError(
      `HTTP fallback is blocked for migrated resource path "${normalizePath(path)}". Route through entity contract client instead.`,
      {
        status: 500,
        code: 'HTTP_FALLBACK_BLOCKED_MIGRATED_RESOURCE',
        details: {
          path: normalizePath(path),
          blockedPrefix,
        },
      },
    );
  }

  const headers = new Headers(init.headers || {});
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return apiRequest<T>(path, {
    ...init,
    headers,
  });
}
