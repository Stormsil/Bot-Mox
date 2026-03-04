import { apiContract } from '@botmox/api-contract';
import { initClient } from '@ts-rest/core';
import { API_BASE_URL } from '../../../config/env';
import { ApiClientError } from '../apiClient';

const CONTRACT_ERROR_MESSAGE_BY_CODE: Record<string, string> = {
  AGENTS_STORAGE_UNAVAILABLE:
    'Agent pairing storage is not ready yet. Retry after backend startup completes.',
  VM_OPS_UNAVAILABLE:
    'VM operations storage is not ready yet. Retry after backend startup completes.',
  AGENT_OFFLINE: 'Agent is offline or not paired yet.',
};

let cachedContractRuntimeClient: ReturnType<typeof initContractRuntimeClient> | null = null;
let cachedContractBaseUrl = '';

type ContractRuntimeClient = ReturnType<typeof initContractRuntimeClient>;

type WithOptionalAuthorizationHeader<T> = T extends (args: infer TArgs) => infer TResult
  ? TArgs extends { headers: infer THeaders }
    ? (args: Omit<TArgs, 'headers'> & { headers?: THeaders }) => TResult
    : T
  : T;

type RuntimeClientWithoutProviderAuthHeaders = {
  [TKey in keyof ContractRuntimeClient]: WithOptionalAuthorizationHeader<
    ContractRuntimeClient[TKey]
  >;
};

function initContractRuntimeClient(baseUrl: string) {
  return initClient(apiContract, {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    credentials: 'include',
    throwOnUnknownStatus: false,
  });
}

export function resolveContractApiBaseUrl(): string {
  if (API_BASE_URL) {
    return API_BASE_URL;
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  return 'http://localhost:3002';
}

export function getContractRuntimeClient() {
  const baseUrl = resolveContractApiBaseUrl();

  if (cachedContractRuntimeClient && cachedContractBaseUrl === baseUrl) {
    return cachedContractRuntimeClient;
  }

  cachedContractBaseUrl = baseUrl;
  cachedContractRuntimeClient = initContractRuntimeClient(baseUrl);

  return cachedContractRuntimeClient;
}

function withRuntimeAuthorizationFallback(
  client: ContractRuntimeClient,
): RuntimeClientWithoutProviderAuthHeaders {
  return client as unknown as RuntimeClientWithoutProviderAuthHeaders;
}

export function createContractRuntimeClient(): RuntimeClientWithoutProviderAuthHeaders {
  return withRuntimeAuthorizationFallback(getContractRuntimeClient());
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

export * from '../providers/bot-contract-client/runtime';
