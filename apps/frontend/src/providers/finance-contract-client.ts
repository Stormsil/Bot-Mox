import {
  financeDailyStatsSchema,
  financeGoldPriceHistorySchema,
  financeOperationCreateSchema,
  financeOperationPatchSchema,
  financeOperationRecordSchema,
} from '@botmox/api-contract';
import { ApiClientError, type ApiSuccessEnvelope } from '../shared/api/apiClient';
import {
  createContractRuntimeClient,
  resolveContractAuthorizationHeader,
  toContractApiClientError,
} from '../shared/api/contracts/runtimeClient';

interface FinanceListQuery {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  q?: string;
}

function isFinanceDegradedReadError(error: unknown): boolean {
  if (!(error instanceof ApiClientError)) {
    return false;
  }
  const code = String(error.code || '')
    .trim()
    .toUpperCase();
  if (error.status === 502) {
    return true;
  }
  return code === 'VM_OPS_UNAVAILABLE' || code === 'AGENTS_STORAGE_UNAVAILABLE';
}

export type FinanceOperationContractRecord = ReturnType<typeof financeOperationRecordSchema.parse>;
export type FinanceDailyStatsContractMap = ReturnType<typeof financeDailyStatsSchema.parse>;
export type FinanceGoldPriceHistoryContractMap = ReturnType<
  typeof financeGoldPriceHistorySchema.parse
>;

export async function listFinanceOperationsViaContract(
  query: FinanceListQuery,
): Promise<ApiSuccessEnvelope<FinanceOperationContractRecord[]>> {
  try {
    const client = createContractRuntimeClient();
    const authorization = resolveContractAuthorizationHeader();
    const response = await client.financeOperationsList({
      headers: { authorization },
      query,
    });

    if (response.status !== 200) {
      throw toContractApiClientError('/api/v1/finance/operations', response.status, response.body);
    }

    return {
      success: true,
      data: financeOperationRecordSchema.array().parse(response.body.data),
      ...(response.body.meta ? { meta: response.body.meta } : {}),
    };
  } catch (error) {
    if (!isFinanceDegradedReadError(error)) {
      throw error;
    }
    return {
      success: true,
      data: [],
      meta: { total: 0, page: Number(query.page || 1), limit: Number(query.limit || 50) },
    };
  }
}

export async function getFinanceOperationViaContract(
  id: string,
): Promise<ApiSuccessEnvelope<FinanceOperationContractRecord>> {
  const client = createContractRuntimeClient();
  const authorization = resolveContractAuthorizationHeader();
  const response = await client.financeOperationsGet({
    headers: { authorization },
    params: { id },
  });

  if (response.status !== 200) {
    throw toContractApiClientError(
      `/api/v1/finance/operations/${id}`,
      response.status,
      response.body,
    );
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
  const client = createContractRuntimeClient();
  const authorization = resolveContractAuthorizationHeader();
  const body = financeOperationCreateSchema.parse(payload);
  const response = await client.financeOperationsCreate({
    headers: { authorization },
    body,
  });

  if (response.status !== 201) {
    throw toContractApiClientError('/api/v1/finance/operations', response.status, response.body);
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
  const client = createContractRuntimeClient();
  const authorization = resolveContractAuthorizationHeader();
  const body = financeOperationPatchSchema.parse(payload);
  const response = await client.financeOperationsPatch({
    headers: { authorization },
    params: { id },
    body,
  });

  if (response.status !== 200) {
    throw toContractApiClientError(
      `/api/v1/finance/operations/${id}`,
      response.status,
      response.body,
    );
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
  const client = createContractRuntimeClient();
  const authorization = resolveContractAuthorizationHeader();
  const response = await client.financeOperationsDelete({
    headers: { authorization },
    params: { id },
  });

  if (response.status !== 200) {
    throw toContractApiClientError(
      `/api/v1/finance/operations/${id}`,
      response.status,
      response.body,
    );
  }

  return response.body as ApiSuccessEnvelope<{ id: string; deleted: boolean }>;
}

export async function getFinanceDailyStatsViaContract(): Promise<
  ApiSuccessEnvelope<FinanceDailyStatsContractMap>
> {
  try {
    const client = createContractRuntimeClient();
    const authorization = resolveContractAuthorizationHeader();
    const response = await client.financeDailyStats({
      headers: { authorization },
    });

    if (response.status !== 200) {
      throw toContractApiClientError('/api/v1/finance/daily-stats', response.status, response.body);
    }

    return {
      success: true,
      data: financeDailyStatsSchema.parse(response.body.data),
      ...(response.body.meta ? { meta: response.body.meta } : {}),
    };
  } catch (error) {
    if (!isFinanceDegradedReadError(error)) {
      throw error;
    }
    return {
      success: true,
      data: financeDailyStatsSchema.parse({}),
    };
  }
}

export async function getFinanceGoldPriceHistoryViaContract(): Promise<
  ApiSuccessEnvelope<FinanceGoldPriceHistoryContractMap>
> {
  try {
    const client = createContractRuntimeClient();
    const authorization = resolveContractAuthorizationHeader();
    const response = await client.financeGoldPriceHistory({
      headers: { authorization },
    });

    if (response.status !== 200) {
      throw toContractApiClientError(
        '/api/v1/finance/gold-price-history',
        response.status,
        response.body,
      );
    }

    return {
      success: true,
      data: financeGoldPriceHistorySchema.parse(response.body.data),
      ...(response.body.meta ? { meta: response.body.meta } : {}),
    };
  } catch (error) {
    if (!isFinanceDegradedReadError(error)) {
      throw error;
    }
    return {
      success: true,
      data: financeGoldPriceHistorySchema.parse({}),
    };
  }
}
