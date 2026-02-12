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

const AUTH_TOKEN_KEY = 'botmox.auth.token';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

function resolveResourcePath(resource: string): string {
  const normalized = String(resource || '').trim().toLowerCase();

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

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const requestUrl = /^https?:\/\//i.test(path) ? path : buildApiUrl(path);
  const response = await fetch(requestUrl, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...(init.headers || {}),
    },
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.success) {
    const message = payload?.error?.message || payload?.error || `HTTP ${response.status}`;
    throw new Error(String(message));
  }

  return payload as T;
}

function normalizeListResponse<TData extends BaseRecord = BaseRecord>(
  payload: { data?: TData[]; meta?: { total?: number } }
): GetListResponse<TData> {
  const data = Array.isArray(payload.data) ? payload.data : [];
  const total = Number(payload?.meta?.total ?? data.length);
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
    const queryFilter = params.filters.find((item) => 'field' in item && String(item.field) === 'q');
    if (queryFilter && 'value' in queryFilter && queryFilter.value) {
      search.set('q', String(queryFilter.value));
    }
  }

  const query = search.toString();
  return query ? `?${query}` : '';
}

export const dataProvider: DataProvider = {
  getList: async <TData extends BaseRecord = BaseRecord>(
    params: GetListParams
  ): Promise<GetListResponse<TData>> => {
    const basePath = resolveResourcePath(params.resource);
    const query = extractQueryFromListParams(params);
    const payload = await request<{ data?: TData[]; meta?: { total?: number } }>(`${basePath}${query}`);
    return normalizeListResponse(payload);
  },

  getOne: async <TData extends BaseRecord = BaseRecord>(
    params: GetOneParams
  ): Promise<GetOneResponse<TData>> => {
    const basePath = resolveResourcePath(params.resource);
    const payload = await request<{ data: TData }>(`${basePath}/${encodeURIComponent(String(params.id))}`);
    return { data: payload.data };
  },

  create: async <TData extends BaseRecord = BaseRecord, TVariables = Record<string, unknown>>(
    params: CreateParams<TVariables>
  ): Promise<CreateResponse<TData>> => {
    const basePath = resolveResourcePath(params.resource);
    const payload = await request<{ data: TData }>(basePath, {
      method: 'POST',
      body: JSON.stringify(params.variables || {}),
    });
    return { data: payload.data };
  },

  update: async <TData extends BaseRecord = BaseRecord, TVariables = Record<string, unknown>>(
    params: UpdateParams<TVariables>
  ): Promise<UpdateResponse<TData>> => {
    const basePath = resolveResourcePath(params.resource);
    const payload = await request<{ data: TData }>(`${basePath}/${encodeURIComponent(String(params.id))}`, {
      method: 'PATCH',
      body: JSON.stringify(params.variables || {}),
    });
    return { data: payload.data };
  },

  deleteOne: async <TData extends BaseRecord = BaseRecord, TVariables = Record<string, unknown>>(
    params: DeleteOneParams<TVariables>
  ): Promise<DeleteOneResponse<TData>> => {
    const basePath = resolveResourcePath(params.resource);
    await request(`${basePath}/${encodeURIComponent(String(params.id))}`, {
      method: 'DELETE',
    });

    return {
      data: { id: params.id } as TData,
    };
  },

  getMany: async <TData extends BaseRecord = BaseRecord>(
    params: GetManyParams
  ): Promise<GetManyResponse<TData>> => {
    const basePath = resolveResourcePath(params.resource);
    const items = await Promise.all(
      params.ids.map(async (id) => {
        const payload = await request<{ data: TData }>(`${basePath}/${encodeURIComponent(String(id))}`);
        return payload.data;
      })
    );

    return { data: items };
  },

  getApiUrl: () => buildApiUrl('/api/v1'),

  custom: async <TData extends BaseRecord = BaseRecord>(params: unknown): Promise<CustomResponse<TData>> => {
    const customParams =
      params && typeof params === 'object'
        ? (params as { method?: unknown; url?: unknown; payload?: unknown })
        : {};
    const method = String(customParams.method || 'GET').toUpperCase();
    const path = String(customParams.url || '/api/v1/health');
    const payload = await request<{ data: TData }>(path, {
      method,
      body: customParams.payload ? JSON.stringify(customParams.payload) : undefined,
    });

    return {
      data: payload.data,
    };
  },
};
