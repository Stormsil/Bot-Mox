import { type ApiSuccessEnvelope, apiRequest } from '../../../shared/api/apiClient';

export async function requestHttpFallback<T>(
  path: string,
  init: RequestInit = {},
): Promise<ApiSuccessEnvelope<T>> {
  const headers = new Headers(init.headers || {});
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return apiRequest<T>(path, {
    ...init,
    headers,
  });
}
