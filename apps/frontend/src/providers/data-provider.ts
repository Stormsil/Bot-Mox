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
  extractContractQueryFromListParams,
  extractQueryFromListParams,
  isBotResource,
  normalizeListResponse,
  resolveResourcePath,
  toContractResourceKind,
} from './data-provider/utils';
import {
  createResourceViaContract,
  deleteResourceViaContract,
  getResourceViaContract,
  listResourcesViaContract,
  updateResourceViaContract,
} from './resource-contract-client';

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
