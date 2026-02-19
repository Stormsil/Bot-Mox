import { createApiContractClient } from '@botmox/api-contract';
import { API_BASE_URL } from '../config/env';
import { ApiClientError, type ApiSuccessEnvelope } from '../services/apiClient';
import { withAuthHeaders } from '../services/authFetch';
import type { IPQSResponse } from '../types';

interface IpqsStatusPayload {
  enabled?: unknown;
  configured?: unknown;
  supabaseSettingsConnected?: unknown;
}

interface IpqsBatchPayload {
  results: Array<{
    ip: string;
    success: boolean;
    data?: IPQSResponse;
    error?: string;
    details?: unknown;
  }>;
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

export async function getIpqsStatusViaContract(): Promise<ApiSuccessEnvelope<IpqsStatusPayload>> {
  const client = createRuntimeClient();
  const authorization = resolveAuthorizationHeader();
  const response = await client.ipqsStatusGet({
    headers: { authorization },
  });

  if (response.status !== 200) {
    throw toApiClientError('/api/v1/ipqs/status', response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<IpqsStatusPayload>;
}

export async function checkIpqsViaContract(ip: string): Promise<ApiSuccessEnvelope<IPQSResponse>> {
  const client = createRuntimeClient();
  const authorization = resolveAuthorizationHeader();
  const response = await client.ipqsCheck({
    headers: { authorization },
    body: { ip },
  });

  if (response.status !== 200) {
    throw toApiClientError('/api/v1/ipqs/check', response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<IPQSResponse>;
}

export async function checkIpqsBatchViaContract(
  ips: string[],
): Promise<ApiSuccessEnvelope<IpqsBatchPayload>> {
  const client = createRuntimeClient();
  const authorization = resolveAuthorizationHeader();
  const response = await client.ipqsCheckBatch({
    headers: { authorization },
    body: { ips },
  });

  if (response.status !== 200) {
    throw toApiClientError('/api/v1/ipqs/check-batch', response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<IpqsBatchPayload>;
}
