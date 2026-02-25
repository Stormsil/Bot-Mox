import { ApiClientError } from './apiClient';

const AUTH_IDENTITY_KEY = 'botmox.auth.identity';

export function hasFrontendWriteAccess(): boolean {
  if (typeof localStorage === 'undefined') {
    return true;
  }

  const raw = localStorage.getItem(AUTH_IDENTITY_KEY);
  if (!raw) {
    return true;
  }

  try {
    const parsed = JSON.parse(raw) as {
      access?: {
        write_access?: unknown;
      };
    };
    return parsed?.access?.write_access === true;
  } catch {
    return true;
  }
}

export function assertFrontendWriteAccess(scopeOrPath: string): void {
  if (hasFrontendWriteAccess()) {
    return;
  }

  const error = new ApiClientError('Premium access is required for write operations', {
    status: 403,
    code: 'PREMIUM_REQUIRED',
    details: {
      scope: scopeOrPath,
      source: 'frontend_write_guard',
    },
  }) as ApiClientError & { statusCode?: number };
  error.statusCode = 403;
  throw error;
}
