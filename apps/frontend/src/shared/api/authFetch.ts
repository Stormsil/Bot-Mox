export function withAuthHeaders(headers?: HeadersInit): Headers {
  return new Headers(headers || {});
}

export function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  return fetch(input, {
    ...init,
    cache: init.cache ?? 'no-store',
    credentials: 'include',
    headers: withAuthHeaders(init.headers),
  });
}
