import { createApiContractClient } from '@botmox/api-contract';
import { API_BASE_URL } from '../config/env';
import { ApiClientError, type ApiSuccessEnvelope } from '../services/apiClient';
import { withAuthHeaders } from '../services/authFetch';
import type { ApiKeys, NotificationEvents, ProxySettings } from '../types';

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

export async function getApiKeysViaContract(): Promise<ApiSuccessEnvelope<Partial<ApiKeys>>> {
  const client = createRuntimeClient();
  const authorization = resolveAuthorizationHeader();
  const response = await client.settingsApiKeysGet({
    headers: { authorization },
  });

  if (response.status !== 200) {
    throw toApiClientError('/api/v1/settings/api_keys', response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<Partial<ApiKeys>>;
}

export async function putApiKeysViaContract(
  payload: Partial<ApiKeys>,
): Promise<ApiSuccessEnvelope<Partial<ApiKeys>>> {
  const client = createRuntimeClient();
  const authorization = resolveAuthorizationHeader();
  const response = await client.settingsApiKeysPut({
    headers: { authorization },
    body: payload,
  });

  if (response.status !== 200) {
    throw toApiClientError('/api/v1/settings/api_keys', response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<Partial<ApiKeys>>;
}

export async function getProxySettingsViaContract(): Promise<
  ApiSuccessEnvelope<Partial<ProxySettings>>
> {
  const client = createRuntimeClient();
  const authorization = resolveAuthorizationHeader();
  const response = await client.settingsProxyGet({
    headers: { authorization },
  });

  if (response.status !== 200) {
    throw toApiClientError('/api/v1/settings/proxy', response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<Partial<ProxySettings>>;
}

export async function putProxySettingsViaContract(
  payload: Partial<ProxySettings>,
): Promise<ApiSuccessEnvelope<Partial<ProxySettings>>> {
  const client = createRuntimeClient();
  const authorization = resolveAuthorizationHeader();
  const response = await client.settingsProxyPut({
    headers: { authorization },
    body: payload,
  });

  if (response.status !== 200) {
    throw toApiClientError('/api/v1/settings/proxy', response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<Partial<ProxySettings>>;
}

export async function getNotificationEventsViaContract(): Promise<
  ApiSuccessEnvelope<Partial<NotificationEvents>>
> {
  const client = createRuntimeClient();
  const authorization = resolveAuthorizationHeader();
  const response = await client.settingsNotificationEventsGet({
    headers: { authorization },
  });

  if (response.status !== 200) {
    throw toApiClientError('/api/v1/settings/notifications/events', response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<Partial<NotificationEvents>>;
}

export async function putNotificationEventsViaContract(
  payload: Partial<NotificationEvents>,
): Promise<ApiSuccessEnvelope<Partial<NotificationEvents>>> {
  const client = createRuntimeClient();
  const authorization = resolveAuthorizationHeader();
  const response = await client.settingsNotificationEventsPut({
    headers: { authorization },
    body: payload,
  });

  if (response.status !== 200) {
    throw toApiClientError('/api/v1/settings/notifications/events', response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<Partial<NotificationEvents>>;
}
