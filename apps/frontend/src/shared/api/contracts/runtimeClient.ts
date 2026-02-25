import { createApiContractClient } from '@botmox/api-contract';
import { API_BASE_URL } from '../../../config/env';
import { ApiClientError } from '../apiClient';
import { withAuthHeaders } from '../authFetch';

const CONTRACT_ERROR_MESSAGE_BY_CODE: Record<string, string> = {
  AGENTS_STORAGE_UNAVAILABLE:
    'Agent pairing storage is not ready yet. Retry after backend startup completes.',
  VM_OPS_UNAVAILABLE:
    'VM operations storage is not ready yet. Retry after backend startup completes.',
  AGENT_OFFLINE: 'Agent is offline or not paired yet.',
};

let cachedContractRuntimeClient: ReturnType<typeof createApiContractClient> | null = null;
let cachedContractBaseUrl = '';
let cachedContractToken = '';

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

export function getContractRuntimeClient() {
  const baseUrl = resolveContractApiBaseUrl();
  const accessToken = resolveContractBearerToken();

  if (
    cachedContractRuntimeClient &&
    cachedContractBaseUrl === baseUrl &&
    cachedContractToken === accessToken
  ) {
    return cachedContractRuntimeClient;
  }

  cachedContractBaseUrl = baseUrl;
  cachedContractToken = accessToken;
  cachedContractRuntimeClient = createApiContractClient({
    baseUrl,
    accessToken,
  });

  return cachedContractRuntimeClient;
}

export function createContractRuntimeClient() {
  return getContractRuntimeClient();
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

  const code = String(payload.code || 'API_CONTRACT_ERROR');
  const rawMessage = String(payload.message || '').trim();
  const normalizedMessage =
    CONTRACT_ERROR_MESSAGE_BY_CODE[code] || rawMessage || `Contract request failed: ${path}`;

  return new ApiClientError(normalizedMessage, {
    status,
    code,
    details: payload.details ?? body,
  });
}
