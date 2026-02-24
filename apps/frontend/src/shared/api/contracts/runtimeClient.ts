import { createApiContractClient } from '@botmox/api-contract';
import { API_BASE_URL } from '../../../config/env';
import { ApiClientError } from '../apiClient';
import { withAuthHeaders } from '../authFetch';

export function resolveContractApiBaseUrl(): string {
  if (API_BASE_URL) {
    return API_BASE_URL;
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  return 'http://localhost:3002';
}

export function resolveContractBearerToken(): string {
  const authorization = withAuthHeaders().get('Authorization') || '';
  return authorization.replace(/^Bearer\s+/i, '').trim();
}

export function resolveContractAuthorizationHeader(): string {
  const token = resolveContractBearerToken();
  if (!token) {
    throw new ApiClientError('Missing auth token for contract request', {
      status: 401,
      code: 'MISSING_AUTH_TOKEN',
    });
  }

  return `Bearer ${token}`;
}

export function createContractRuntimeClient() {
  return createApiContractClient({
    baseUrl: resolveContractApiBaseUrl(),
    accessToken: resolveContractBearerToken(),
  });
}

export function toContractApiClientError(
  path: string,
  status: number,
  body: unknown,
): ApiClientError {
  const envelope = body && typeof body === 'object' ? (body as { error?: unknown }) : {};
  const payload =
    envelope.error && typeof envelope.error === 'object'
      ? (envelope.error as { code?: unknown; message?: unknown; details?: unknown })
      : {};

  return new ApiClientError(String(payload.message || `Contract request failed: ${path}`), {
    status,
    code: String(payload.code || 'API_CONTRACT_ERROR'),
    details: payload.details ?? body,
  });
}
