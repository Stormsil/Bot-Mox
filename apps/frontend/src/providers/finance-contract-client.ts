import {
  createApiContractClient,
  financeDailyStatsSchema,
  financeGoldPriceHistorySchema,
  financeOperationCreateSchema,
  financeOperationPatchSchema,
  financeOperationRecordSchema,
} from '@botmox/api-contract';
import { API_BASE_URL } from '../config/env';
import { ApiClientError, type ApiSuccessEnvelope } from '../services/apiClient';
import { withAuthHeaders } from '../services/authFetch';

interface FinanceListQuery {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  q?: string;
}

export type FinanceOperationContractRecord = ReturnType<typeof financeOperationRecordSchema.parse>;
export type FinanceDailyStatsContractMap = ReturnType<typeof financeDailyStatsSchema.parse>;
export type FinanceGoldPriceHistoryContractMap = ReturnType<
  typeof financeGoldPriceHistorySchema.parse
>;

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

export async function listFinanceOperationsViaContract(
  query: FinanceListQuery,
): Promise<ApiSuccessEnvelope<FinanceOperationContractRecord[]>> {
  const client = createRuntimeClient();
  const authorization = resolveAuthorizationHeader();
  const response = await client.financeOperationsList({
    headers: { authorization },
    query,
  });

  if (response.status !== 200) {
    throw toApiClientError('/api/v1/finance/operations', response.status, response.body);
  }

  return {
    success: true,
    data: financeOperationRecordSchema.array().parse(response.body.data),
    ...(response.body.meta ? { meta: response.body.meta } : {}),
  };
}

export async function getFinanceOperationViaContract(
  id: string,
): Promise<ApiSuccessEnvelope<FinanceOperationContractRecord>> {
  const client = createRuntimeClient();
  const authorization = resolveAuthorizationHeader();
  const response = await client.financeOperationsGet({
    headers: { authorization },
    params: { id },
  });

  if (response.status !== 200) {
    throw toApiClientError(`/api/v1/finance/operations/${id}`, response.status, response.body);
  }

  return {
    success: true,
    data: financeOperationRecordSchema.parse(response.body.data),
    ...(response.body.meta ? { meta: response.body.meta } : {}),
  };
}

export async function createFinanceOperationViaContract(
  payload: unknown,
): Promise<ApiSuccessEnvelope<FinanceOperationContractRecord>> {
  const client = createRuntimeClient();
  const authorization = resolveAuthorizationHeader();
  const body = financeOperationCreateSchema.parse(payload);
  const response = await client.financeOperationsCreate({
    headers: { authorization },
    body,
  });

  if (response.status !== 201) {
    throw toApiClientError('/api/v1/finance/operations', response.status, response.body);
  }

  return {
    success: true,
    data: financeOperationRecordSchema.parse(response.body.data),
    ...(response.body.meta ? { meta: response.body.meta } : {}),
  };
}

export async function patchFinanceOperationViaContract(
  id: string,
  payload: unknown,
): Promise<ApiSuccessEnvelope<FinanceOperationContractRecord>> {
  const client = createRuntimeClient();
  const authorization = resolveAuthorizationHeader();
  const body = financeOperationPatchSchema.parse(payload);
  const response = await client.financeOperationsPatch({
    headers: { authorization },
    params: { id },
    body,
  });

  if (response.status !== 200) {
    throw toApiClientError(`/api/v1/finance/operations/${id}`, response.status, response.body);
  }

  return {
    success: true,
    data: financeOperationRecordSchema.parse(response.body.data),
    ...(response.body.meta ? { meta: response.body.meta } : {}),
  };
}

export async function deleteFinanceOperationViaContract(
  id: string,
): Promise<ApiSuccessEnvelope<{ id: string; deleted: boolean }>> {
  const client = createRuntimeClient();
  const authorization = resolveAuthorizationHeader();
  const response = await client.financeOperationsDelete({
    headers: { authorization },
    params: { id },
  });

  if (response.status !== 200) {
    throw toApiClientError(`/api/v1/finance/operations/${id}`, response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<{ id: string; deleted: boolean }>;
}

export async function getFinanceDailyStatsViaContract(): Promise<
  ApiSuccessEnvelope<FinanceDailyStatsContractMap>
> {
  const client = createRuntimeClient();
  const authorization = resolveAuthorizationHeader();
  const response = await client.financeDailyStats({
    headers: { authorization },
  });

  if (response.status !== 200) {
    throw toApiClientError('/api/v1/finance/daily-stats', response.status, response.body);
  }

  return {
    success: true,
    data: financeDailyStatsSchema.parse(response.body.data),
    ...(response.body.meta ? { meta: response.body.meta } : {}),
  };
}

export async function getFinanceGoldPriceHistoryViaContract(): Promise<
  ApiSuccessEnvelope<FinanceGoldPriceHistoryContractMap>
> {
  const client = createRuntimeClient();
  const authorization = resolveAuthorizationHeader();
  const response = await client.financeGoldPriceHistory({
    headers: { authorization },
  });

  if (response.status !== 200) {
    throw toApiClientError('/api/v1/finance/gold-price-history', response.status, response.body);
  }

  return {
    success: true,
    data: financeGoldPriceHistorySchema.parse(response.body.data),
    ...(response.body.meta ? { meta: response.body.meta } : {}),
  };
}
