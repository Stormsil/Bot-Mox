import type { ApiKeys, NotificationEvents, ProxySettings } from '../entities/settings/model/types';
import { ApiClientError, type ApiSuccessEnvelope } from '../shared/api/apiClient';
import {
  createContractRuntimeClient,
  resolveContractAuthorizationHeader,
  toContractApiClientError,
} from '../shared/api/contracts/runtimeClient';

function isExpectedSettingsReadDegradedError(error: unknown): error is ApiClientError {
  if (!(error instanceof ApiClientError)) {
    return false;
  }
  const code = String(error.code || '').trim();
  return (
    error.status === 502 || code === 'AGENTS_STORAGE_UNAVAILABLE' || code === 'VM_OPS_UNAVAILABLE'
  );
}

export async function getApiKeysViaContract(): Promise<ApiSuccessEnvelope<Partial<ApiKeys>>> {
  try {
    const client = createContractRuntimeClient();
    const authorization = resolveContractAuthorizationHeader();
    const response = await client.settingsApiKeysGet({
      headers: { authorization },
    });

    if (response.status !== 200) {
      throw toContractApiClientError('/api/v1/settings/api_keys', response.status, response.body);
    }

    return response.body as ApiSuccessEnvelope<Partial<ApiKeys>>;
  } catch (error) {
    if (isExpectedSettingsReadDegradedError(error)) {
      return { success: true, data: {} };
    }
    throw error;
  }
}

export async function putApiKeysViaContract(
  payload: Partial<ApiKeys>,
): Promise<ApiSuccessEnvelope<Partial<ApiKeys>>> {
  const client = createContractRuntimeClient();
  const authorization = resolveContractAuthorizationHeader();
  const response = await client.settingsApiKeysPut({
    headers: { authorization },
    body: payload,
  });

  if (response.status !== 200) {
    throw toContractApiClientError('/api/v1/settings/api_keys', response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<Partial<ApiKeys>>;
}

export async function getProxySettingsViaContract(): Promise<
  ApiSuccessEnvelope<Partial<ProxySettings>>
> {
  try {
    const client = createContractRuntimeClient();
    const authorization = resolveContractAuthorizationHeader();
    const response = await client.settingsProxyGet({
      headers: { authorization },
    });

    if (response.status !== 200) {
      throw toContractApiClientError('/api/v1/settings/proxy', response.status, response.body);
    }

    return response.body as ApiSuccessEnvelope<Partial<ProxySettings>>;
  } catch (error) {
    if (isExpectedSettingsReadDegradedError(error)) {
      return { success: true, data: {} };
    }
    throw error;
  }
}

export async function putProxySettingsViaContract(
  payload: Partial<ProxySettings>,
): Promise<ApiSuccessEnvelope<Partial<ProxySettings>>> {
  const client = createContractRuntimeClient();
  const authorization = resolveContractAuthorizationHeader();
  const response = await client.settingsProxyPut({
    headers: { authorization },
    body: payload,
  });

  if (response.status !== 200) {
    throw toContractApiClientError('/api/v1/settings/proxy', response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<Partial<ProxySettings>>;
}

export async function getNotificationEventsViaContract(): Promise<
  ApiSuccessEnvelope<Partial<NotificationEvents>>
> {
  try {
    const client = createContractRuntimeClient();
    const authorization = resolveContractAuthorizationHeader();
    const response = await client.settingsNotificationEventsGet({
      headers: { authorization },
    });

    if (response.status !== 200) {
      throw toContractApiClientError(
        '/api/v1/settings/notifications/events',
        response.status,
        response.body,
      );
    }

    return response.body as ApiSuccessEnvelope<Partial<NotificationEvents>>;
  } catch (error) {
    if (isExpectedSettingsReadDegradedError(error)) {
      return { success: true, data: {} };
    }
    throw error;
  }
}

export async function putNotificationEventsViaContract(
  payload: Partial<NotificationEvents>,
): Promise<ApiSuccessEnvelope<Partial<NotificationEvents>>> {
  const client = createContractRuntimeClient();
  const authorization = resolveContractAuthorizationHeader();
  const response = await client.settingsNotificationEventsPut({
    headers: { authorization },
    body: payload,
  });

  if (response.status !== 200) {
    throw toContractApiClientError(
      '/api/v1/settings/notifications/events',
      response.status,
      response.body,
    );
  }

  return response.body as ApiSuccessEnvelope<Partial<NotificationEvents>>;
}
