import {
  financeAggregateQuerySchema,
  financeBreakdownSchema,
  financeDailyStatsSchema,
  financeGoldPriceHistorySchema,
  financeOperationCreateSchema,
  financeOperationPatchSchema,
  financeOperationRecordSchema,
  financeProjectPerformanceSchema,
  financeSummarySchema,
  financeTimeSeriesQuerySchema,
  financeTimeSeriesSchema,
} from '@botmox/api-contract';
import { ApiClientError, type ApiSuccessEnvelope } from '../apiClient';
import {
  createContractRuntimeClient,
  resolveContractAuthorizationHeader,
  toContractApiClientError,
} from '../contracts/runtimeClient';

interface FinanceListQuery {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  q?: string;
}

interface FinanceAggregateQuery {
  from_ts?: number;
  to_ts?: number;
  currency?: string;
  project_id?: string;
  bot_id?: string;
}

interface FinanceTimeSeriesQuery extends FinanceAggregateQuery {
  granularity?: 'hour' | 'day' | 'week' | 'month';
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
export type FinanceSummaryContractRecord = ReturnType<typeof financeSummarySchema.parse>;
export type FinanceBreakdownContractRecord = ReturnType<typeof financeBreakdownSchema.parse>;
export type FinanceProjectPerformanceContractRecord = ReturnType<
  typeof financeProjectPerformanceSchema.parse
>;
export type FinanceTimeSeriesContractRecord = ReturnType<typeof financeTimeSeriesSchema.parse>;

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

export async function getFinanceSummaryViaContract(
  query: FinanceAggregateQuery,
): Promise<ApiSuccessEnvelope<FinanceSummaryContractRecord>> {
  try {
    const client = createContractRuntimeClient();
    const authorization = resolveContractAuthorizationHeader();
    const parsedQuery = financeAggregateQuerySchema.parse(query || {});
    const response = await client.financeSummary({
      headers: { authorization },
      query: parsedQuery,
    });

    if (response.status !== 200) {
      throw toContractApiClientError('/api/v1/finance/summary', response.status, response.body);
    }

    return {
      success: true,
      data: financeSummarySchema.parse(response.body.data),
      ...(response.body.meta ? { meta: response.body.meta } : {}),
    };
  } catch (error) {
    if (!isFinanceDegradedReadError(error)) {
      throw error;
    }
    const parsedQuery = financeAggregateQuerySchema.parse(query || {});
    return {
      success: true,
      data: financeSummarySchema.parse({
        income_total: 0,
        expense_total: 0,
        net_total: 0,
        margin_percent: 0,
        operation_count: 0,
        period: {
          ...(parsedQuery.from_ts !== undefined ? { from_ts: parsedQuery.from_ts } : {}),
          ...(parsedQuery.to_ts !== undefined ? { to_ts: parsedQuery.to_ts } : {}),
        },
      }),
    };
  }
}

export async function getFinanceBreakdownViaContract(
  query: FinanceAggregateQuery,
): Promise<ApiSuccessEnvelope<FinanceBreakdownContractRecord>> {
  try {
    const client = createContractRuntimeClient();
    const authorization = resolveContractAuthorizationHeader();
    const parsedQuery = financeAggregateQuerySchema.parse(query || {});
    const response = await client.financeBreakdown({
      headers: { authorization },
      query: parsedQuery,
    });

    if (response.status !== 200) {
      throw toContractApiClientError('/api/v1/finance/breakdown', response.status, response.body);
    }

    return {
      success: true,
      data: financeBreakdownSchema.parse(response.body.data),
      ...(response.body.meta ? { meta: response.body.meta } : {}),
    };
  } catch (error) {
    if (!isFinanceDegradedReadError(error)) {
      throw error;
    }
    const parsedQuery = financeAggregateQuerySchema.parse(query || {});
    return {
      success: true,
      data: financeBreakdownSchema.parse({
        group_by: 'category',
        items: [],
        totals: {
          income_total: 0,
          expense_total: 0,
          net_total: 0,
          margin_percent: 0,
          operation_count: 0,
          period: {
            ...(parsedQuery.from_ts !== undefined ? { from_ts: parsedQuery.from_ts } : {}),
            ...(parsedQuery.to_ts !== undefined ? { to_ts: parsedQuery.to_ts } : {}),
          },
        },
      }),
    };
  }
}

function toProjectPerformanceRecord(
  breakdown: FinanceBreakdownContractRecord,
): FinanceProjectPerformanceContractRecord {
  const directProjectPerformance = (breakdown as { project_performance?: unknown })
    .project_performance;
  const directParseResult = financeProjectPerformanceSchema.safeParse(directProjectPerformance);
  if (directParseResult.success) {
    return directParseResult.data;
  }

  const entries = (breakdown.items || []) as Array<Record<string, unknown>>;
  const items = entries
    .map((entry) => {
      const projectId = String(entry.key || entry.project_id || '').trim();
      if (!projectId) {
        return null;
      }

      const income = Number(entry.income_total ?? 0);
      const expense = Number(entry.expense_total ?? 0);
      const net = Number(entry.net_total ?? income - expense);
      const margin =
        entry.margin_percent === undefined || entry.margin_percent === null
          ? income > 0
            ? (net / income) * 100
            : 0
          : Number(entry.margin_percent);
      const operationCount = Number(entry.operation_count ?? entry.count ?? 0);

      return {
        project_id: projectId,
        income_total: Number.isFinite(income) ? income : 0,
        expense_total: Number.isFinite(expense) ? expense : 0,
        net_total: Number.isFinite(net) ? net : 0,
        margin_percent: Number.isFinite(margin) ? margin : 0,
        operation_count:
          Number.isFinite(operationCount) && operationCount >= 0 ? Math.trunc(operationCount) : 0,
        ...(entry.gold_volume !== undefined && entry.gold_volume !== null
          ? { gold_volume: Number(entry.gold_volume) || 0 }
          : {}),
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  return financeProjectPerformanceSchema.parse({
    source: 'finance_breakdown_aggregate',
    items,
  });
}

export async function getFinanceProjectPerformanceViaContract(
  query: FinanceAggregateQuery,
): Promise<ApiSuccessEnvelope<FinanceProjectPerformanceContractRecord>> {
  const breakdown = await getFinanceBreakdownViaContract(query);
  return {
    ...breakdown,
    data: toProjectPerformanceRecord(breakdown.data),
  };
}

export async function getFinanceTimeSeriesViaContract(
  query: FinanceTimeSeriesQuery,
): Promise<ApiSuccessEnvelope<FinanceTimeSeriesContractRecord>> {
  try {
    const client = createContractRuntimeClient();
    const authorization = resolveContractAuthorizationHeader();
    const parsedQuery = financeTimeSeriesQuerySchema.parse(query || {});
    const response = await client.financeTimeSeries({
      headers: { authorization },
      query: parsedQuery,
    });

    if (response.status !== 200) {
      throw toContractApiClientError('/api/v1/finance/time-series', response.status, response.body);
    }

    return {
      success: true,
      data: financeTimeSeriesSchema.parse(response.body.data),
      ...(response.body.meta ? { meta: response.body.meta } : {}),
    };
  } catch (error) {
    if (!isFinanceDegradedReadError(error)) {
      throw error;
    }
    const parsedQuery = financeTimeSeriesQuerySchema.parse(query || {});
    return {
      success: true,
      data: financeTimeSeriesSchema.parse({
        granularity: parsedQuery.granularity || 'day',
        points: [],
        totals: {
          income_total: 0,
          expense_total: 0,
          net_total: 0,
          margin_percent: 0,
          operation_count: 0,
          period: {
            ...(parsedQuery.from_ts !== undefined ? { from_ts: parsedQuery.from_ts } : {}),
            ...(parsedQuery.to_ts !== undefined ? { to_ts: parsedQuery.to_ts } : {}),
          },
        },
      }),
    };
  }
}
