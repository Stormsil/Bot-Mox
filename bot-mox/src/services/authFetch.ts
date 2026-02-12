const AUTH_TOKEN_KEY = 'botmox.auth.token';
const DEV_DEFAULT_INTERNAL_API_TOKEN = 'change-me-api-token';
const DEV_AUTH_BYPASS_ENABLED =
  import.meta.env.DEV &&
  String(import.meta.env.VITE_DEV_BYPASS_AUTH || 'true').trim().toLowerCase() !== 'false';
const LEGACY_DEV_BYPASS_TOKEN = 'dev-bypass-token';

function resolveDevTokenFallback(): string {
  const fromEnv = String(import.meta.env.VITE_INTERNAL_API_TOKEN || '').trim();
  return fromEnv || DEV_DEFAULT_INTERNAL_API_TOKEN;
}

function getAuthToken(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  try {
    const storedToken = localStorage.getItem(AUTH_TOKEN_KEY) || '';
    if (storedToken && storedToken !== LEGACY_DEV_BYPASS_TOKEN) {
      return storedToken;
    }

    if (DEV_AUTH_BYPASS_ENABLED) {
      const fallbackToken = resolveDevTokenFallback();
      if (fallbackToken && storedToken !== fallbackToken) {
        localStorage.setItem(AUTH_TOKEN_KEY, fallbackToken);
      }
      return fallbackToken;
    }

    return storedToken;
  } catch {
    return '';
  }
}

export function withAuthHeaders(headers?: HeadersInit): Headers {
  const merged = new Headers(headers || {});
  const token = getAuthToken();

  if (token && !merged.has('Authorization')) {
    merged.set('Authorization', `Bearer ${token}`);
  }

  return merged;
}

export function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  return fetch(input, {
    ...init,
    headers: withAuthHeaders(init.headers),
  });
}
