const AUTH_TOKEN_KEY = 'botmox.auth.token';

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
    cache: init.cache ?? 'no-store',
    headers: withAuthHeaders(init.headers),
  });
}
