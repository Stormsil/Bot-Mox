import { createApiContractClient } from '@botmox/api-contract';
import { API_BASE_URL } from '../config/env';
import type { ApiSuccessEnvelope } from '../services/apiClient';
import { ApiClientError } from '../services/apiClient';
import { withAuthHeaders } from '../services/authFetch';

export type ContractResourceKind = 'licenses' | 'proxies' | 'subscriptions';

interface ResourceListQuery {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  q?: string;
}

function resolveApiBaseUrl(): string {
  if (API_BASE_URL) {
    return API_BASE_URL;
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  return 'http://localhost:3002';
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

export async function listResourcesViaContract(
  kind: ContractResourceKind,
  query: ResourceListQuery,
): Promise<ApiSuccessEnvelope<Record<string, unknown>[]>> {
  const client = createRuntimeClient();
  const authorization = resolveAuthorizationHeader();
  const response = await client.resourcesList({
    params: { kind },
    headers: { authorization },
    query,
  });

  if (response.status !== 200) {
    throw toApiClientError(`/api/v1/resources/${kind}`, response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<Record<string, unknown>[]>;
}

export async function upsertResourceViaContract(
  kind: ContractResourceKind,
  id: string,
  payload: Record<string, unknown>,
): Promise<ApiSuccessEnvelope<Record<string, unknown>>> {
  return updateResourceViaContract(kind, id, payload);
}

export async function getResourceViaContract(
  kind: ContractResourceKind,
  id: string,
): Promise<ApiSuccessEnvelope<Record<string, unknown>>> {
  const client = createRuntimeClient();
  const authorization = resolveAuthorizationHeader();
  const response = await client.resourcesGet({
    params: { kind, id },
    headers: { authorization },
  });

  if (response.status !== 200) {
    throw toApiClientError(`/api/v1/resources/${kind}/${id}`, response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<Record<string, unknown>>;
}

export async function createResourceViaContract(
  kind: ContractResourceKind,
  payload: Record<string, unknown>,
): Promise<ApiSuccessEnvelope<Record<string, unknown>>> {
  const client = createRuntimeClient();
  const authorization = resolveAuthorizationHeader();
  const response = await client.resourcesCreate({
    params: { kind },
    headers: { authorization },
    body: payload,
  });

  if (response.status !== 201) {
    throw toApiClientError(`/api/v1/resources/${kind}`, response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<Record<string, unknown>>;
}

export async function updateResourceViaContract(
  kind: ContractResourceKind,
  id: string,
  payload: Record<string, unknown>,
): Promise<ApiSuccessEnvelope<Record<string, unknown>>> {
  const client = createRuntimeClient();
  const authorization = resolveAuthorizationHeader();
  const response = await client.resourcesUpdate({
    params: { kind, id },
    headers: { authorization },
    body: payload,
  });

  if (response.status !== 200) {
    throw toApiClientError(`/api/v1/resources/${kind}/${id}`, response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<Record<string, unknown>>;
}

export async function deleteResourceViaContract(
  kind: ContractResourceKind,
  id: string,
): Promise<ApiSuccessEnvelope<{ id: string; deleted: boolean }>> {
  const client = createRuntimeClient();
  const authorization = resolveAuthorizationHeader();
  const response = await client.resourcesDelete({
    params: { kind, id },
    headers: { authorization },
  });

  if (response.status !== 200) {
    throw toApiClientError(`/api/v1/resources/${kind}/${id}`, response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<{ id: string; deleted: boolean }>;
}
