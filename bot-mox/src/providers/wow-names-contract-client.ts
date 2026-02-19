import { createApiContractClient } from '@botmox/api-contract';
import { API_BASE_URL } from '../config/env';
import { ApiClientError, type ApiSuccessEnvelope } from '../services/apiClient';
import { withAuthHeaders } from '../services/authFetch';

interface WowNamesQuery {
  batches?: number;
  count?: number;
}

type WowNamesPayload = {
  names: string[];
  random?: string;
  source?: string;
  batches?: number;
} & Record<string, unknown>;

function resolveApiBaseUrl(): string {
  if (API_BASE_URL) {
    return API_BASE_URL;
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  return 'http://localhost:3001';
}

function resolveBearerToken(): string {
  const authorization = withAuthHeaders().get('Authorization') || '';
  return authorization.replace(/^Bearer\s+/i, '').trim();
}

function resolveAuthorizationHeader(): string {
  const token = resolveBearerToken();
  if (!token) {
    throw new ApiClientError('Missing auth token for contract request', {
      status: 401,
      code: 'MISSING_AUTH_TOKEN',
    });
  }

  return `Bearer ${token}`;
}

function createRuntimeClient() {
  return createApiContractClient({
    baseUrl: resolveApiBaseUrl(),
    accessToken: resolveBearerToken(),
  });
}

function toApiClientError(path: string, status: number, body: unknown): ApiClientError {
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

export async function getWowNamesViaContract(
  query: WowNamesQuery,
): Promise<ApiSuccessEnvelope<WowNamesPayload>> {
  const client = createRuntimeClient();
  const authorization = resolveAuthorizationHeader();
  const response = await client.wowNamesGet({
    headers: { authorization },
    query,
  });

  if (response.status !== 200) {
    throw toApiClientError('/api/v1/wow-names', response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<WowNamesPayload>;
}
