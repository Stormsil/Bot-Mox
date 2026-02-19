import type {
  BaseRecord,
  CreateParams,
  CreateResponse,
  CustomResponse,
  DataProvider,
  DeleteOneParams,
  DeleteOneResponse,
  GetListParams,
  GetListResponse,
  GetManyParams,
  GetManyResponse,
  GetOneParams,
  GetOneResponse,
  UpdateParams,
  UpdateResponse,
} from '@refinedev/core';
import { buildApiUrl } from '../config/env';
import { type ApiSuccessEnvelope, apiRequest } from '../services/apiClient';
import {
  createBotViaContract,
  deleteBotViaContract,
  getBotViaContract,
  listBotsViaContract,
  patchBotViaContract,
} from './bot-contract-client';
import {
  type ContractResourceKind,
  createResourceViaContract,
  deleteResourceViaContract,
  getResourceViaContract,
  listResourcesViaContract,
  updateResourceViaContract,
} from './resource-contract-client';

function resolveResourcePath(resource: string): string {
  const normalized = String(resource || '')
    .trim()
    .toLowerCase();

  if (normalized === 'licenses' || normalized === 'proxies' || normalized === 'subscriptions') {
    return `/api/v1/resources/${normalized}`;
  }

  if (normalized === 'notes' || normalized === 'notes_v2') {
    return '/api/v1/workspace/notes';
  }

  if (normalized === 'calendar' || normalized === 'calendar_events') {
    return '/api/v1/workspace/calendar';
  }

  if (normalized === 'kanban' || normalized === 'kanban_tasks') {
    return '/api/v1/workspace/kanban';
  }

  if (normalized === 'bots') {
    return '/api/v1/bots';
  }

  if (normalized === 'settings') {
    return '/api/v1/settings';
  }

  return `/api/v1/${normalized}`;
}

function toContractResourceKind(resource: string): ContractResourceKind | null {
  const normalized = String(resource || '')
    .trim()
    .toLowerCase();
  if (normalized === 'licenses' || normalized === 'proxies' || normalized === 'subscriptions') {
    return normalized;
  }

  return null;
}

function isBotResource(resource: string): boolean {
  return (
    String(resource || '')
      .trim()
      .toLowerCase() === 'bots'
  );
}

async function request<T>(path: string, init: RequestInit = {}): Promise<ApiSuccessEnvelope<T>> {
  const headers = new Headers(init.headers || {});
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return apiRequest<T>(path, {
    ...init,
    headers,
  });
}

function normalizeListResponse<TData extends BaseRecord = BaseRecord>(
  payload: ApiSuccessEnvelope<TData[]>,
): GetListResponse<TData> {
  const data = Array.isArray(payload.data) ? payload.data : [];
  const total = Number(payload.meta?.total ?? data.length);
  return { data, total };
}

function extractQueryFromListParams(params: GetListParams): string {
  const search = new URLSearchParams();

  if (params.pagination && 'current' in params.pagination) {
    const current = params.pagination.current ?? 1;
    const pageSize = params.pagination.pageSize ?? 20;
    search.set('page', String(current));
    search.set('limit', String(pageSize));
  }

  if (params.sorters && params.sorters.length > 0) {
    const sorter = params.sorters[0];
    search.set('sort', String(sorter.field));
    search.set('order', sorter.order === 'desc' ? 'desc' : 'asc');
  }

  if (params.filters && params.filters.length > 0) {
    const queryFilter = params.filters.find(
      (item) => 'field' in item && String(item.field) === 'q',
    );
    if (queryFilter && 'value' in queryFilter && queryFilter.value) {
      search.set('q', String(queryFilter.value));
    }
  }

  const query = search.toString();
  return query ? `?${query}` : '';
}

function extractContractQueryFromListParams(params: GetListParams): {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  q?: string;
} {
  const query: {
    page?: number;
    limit?: number;
    sort?: string;
    order?: 'asc' | 'desc';
    q?: string;
  } = {};

  if (params.pagination && 'current' in params.pagination) {
    const current = Number(params.pagination.current ?? 1);
    const pageSize = Number(params.pagination.pageSize ?? 20);
    query.page = Number.isFinite(current) && current > 0 ? current : 1;
    query.limit = Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 20;
  }

  if (params.sorters && params.sorters.length > 0) {
    const sorter = params.sorters[0];
    query.sort = String(sorter.field);
    query.order = sorter.order === 'desc' ? 'desc' : 'asc';
  }

  if (params.filters && params.filters.length > 0) {
    const queryFilter = params.filters.find(
      (item) => 'field' in item && String(item.field) === 'q',
    );
    if (queryFilter && 'value' in queryFilter && queryFilter.value) {
      query.q = String(queryFilter.value);
    }
  }

  return query;
}

export const dataProvider: DataProvider = {
  getList: async <TData extends BaseRecord = BaseRecord>(
    params: GetListParams,
  ): Promise<GetListResponse<TData>> => {
    if (isBotResource(params.resource)) {
      const payload = await listBotsViaContract(extractContractQueryFromListParams(params));
      return normalizeListResponse(payload as ApiSuccessEnvelope<TData[]>);
    }

    const contractKind = toContractResourceKind(params.resource);
    if (contractKind) {
      const payload = await listResourcesViaContract(
        contractKind,
        extractContractQueryFromListParams(params),
      );
      return normalizeListResponse(payload as ApiSuccessEnvelope<TData[]>);
    }

    const basePath = resolveResourcePath(params.resource);
    const query = extractQueryFromListParams(params);
    const payload = await request<TData[]>(`${basePath}${query}`);
    return normalizeListResponse(payload);
  },

  getOne: async <TData extends BaseRecord = BaseRecord>(
    params: GetOneParams,
  ): Promise<GetOneResponse<TData>> => {
    if (isBotResource(params.resource)) {
      const payload = await getBotViaContract(String(params.id));
      return { data: payload.data as TData };
    }

    const contractKind = toContractResourceKind(params.resource);
    if (contractKind) {
      const payload = await getResourceViaContract(contractKind, String(params.id));
      return { data: payload.data as TData };
    }

    const basePath = resolveResourcePath(params.resource);
    const payload = await request<TData>(`${basePath}/${encodeURIComponent(String(params.id))}`);
    return { data: payload.data };
  },

  create: async <TData extends BaseRecord = BaseRecord, TVariables = Record<string, unknown>>(
    params: CreateParams<TVariables>,
  ): Promise<CreateResponse<TData>> => {
    if (isBotResource(params.resource)) {
      const payload = await createBotViaContract({
        ...(params.variables as Record<string, unknown> | undefined),
      });
      return { data: payload.data as TData };
    }

    const contractKind = toContractResourceKind(params.resource);
    if (contractKind) {
      const payload = await createResourceViaContract(contractKind, {
        ...(params.variables as Record<string, unknown> | undefined),
      });
      return { data: payload.data as TData };
    }

    const basePath = resolveResourcePath(params.resource);
    const payload = await request<TData>(basePath, {
      method: 'POST',
      body: JSON.stringify(params.variables || {}),
    });
    return { data: payload.data };
  },

  update: async <TData extends BaseRecord = BaseRecord, TVariables = Record<string, unknown>>(
    params: UpdateParams<TVariables>,
  ): Promise<UpdateResponse<TData>> => {
    if (isBotResource(params.resource)) {
      const payload = await patchBotViaContract(String(params.id), {
        ...(params.variables as Record<string, unknown> | undefined),
      });
      return { data: payload.data as TData };
    }

    const contractKind = toContractResourceKind(params.resource);
    if (contractKind) {
      const payload = await updateResourceViaContract(contractKind, String(params.id), {
        ...(params.variables as Record<string, unknown> | undefined),
      });
      return { data: payload.data as TData };
    }

    const basePath = resolveResourcePath(params.resource);
    const payload = await request<TData>(`${basePath}/${encodeURIComponent(String(params.id))}`, {
      method: 'PATCH',
      body: JSON.stringify(params.variables || {}),
    });
    return { data: payload.data };
  },

  deleteOne: async <TData extends BaseRecord = BaseRecord, TVariables = Record<string, unknown>>(
    params: DeleteOneParams<TVariables>,
  ): Promise<DeleteOneResponse<TData>> => {
    if (isBotResource(params.resource)) {
      await deleteBotViaContract(String(params.id));
      return { data: { id: params.id } as TData };
    }

    const contractKind = toContractResourceKind(params.resource);
    if (contractKind) {
      await deleteResourceViaContract(contractKind, String(params.id));
      return { data: { id: params.id } as TData };
    }

    const basePath = resolveResourcePath(params.resource);
    await request(`${basePath}/${encodeURIComponent(String(params.id))}`, {
      method: 'DELETE',
    });

    return {
      data: { id: params.id } as TData,
    };
  },

  getMany: async <TData extends BaseRecord = BaseRecord>(
    params: GetManyParams,
  ): Promise<GetManyResponse<TData>> => {
    if (isBotResource(params.resource)) {
      const items = await Promise.all(
        params.ids.map(async (id) => {
          const payload = await getBotViaContract(String(id));
          return payload.data as TData;
        }),
      );

      return { data: items };
    }

    const contractKind = toContractResourceKind(params.resource);
    if (contractKind) {
      const items = await Promise.all(
        params.ids.map(async (id) => {
          const payload = await getResourceViaContract(contractKind, String(id));
          return payload.data as TData;
        }),
      );

      return { data: items };
    }

    const basePath = resolveResourcePath(params.resource);
    const items = await Promise.all(
      params.ids.map(async (id) => {
        const payload = await request<TData>(`${basePath}/${encodeURIComponent(String(id))}`);
        return payload.data;
      }),
    );

    return { data: items };
  },

  getApiUrl: () => buildApiUrl('/api/v1'),

  custom: async <TData extends BaseRecord = BaseRecord>(
    params: unknown,
  ): Promise<CustomResponse<TData>> => {
    const customParams =
      params && typeof params === 'object'
        ? (params as { method?: unknown; url?: unknown; payload?: unknown })
        : {};
    const method = String(customParams.method || 'GET').toUpperCase();
    const path = String(customParams.url || '/api/v1/health');
    const payload = await request<TData>(path, {
      method,
      body: customParams.payload ? JSON.stringify(customParams.payload) : undefined,
    });

    return {
      data: payload.data,
    };
  },
};
