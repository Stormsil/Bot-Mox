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
import { buildApiUrl } from '../../config/env';
import type { ApiSuccessEnvelope } from '../../shared/api/apiClient';
import {
  createBotViaContract,
  deleteBotViaContract,
  getBotViaContract,
  listBotsViaContract,
  patchBotViaContract,
} from '../../shared/api/providers/bot-contract-client';
import {
  createFinanceOperationViaContract,
  deleteFinanceOperationViaContract,
  getFinanceOperationViaContract,
  listFinanceOperationsViaContract,
  patchFinanceOperationViaContract,
} from '../../shared/api/providers/finance-contract-client';
import {
  createResourceViaContract,
  deleteResourceViaContract,
  getResourceViaContract,
  listResourcesViaContract,
  updateResourceViaContract,
} from '../../shared/api/providers/resource-contract-client';
import { assertFrontendWriteAccess } from '../../shared/api/writeAccessGuard';
import { requestHttpFallback } from './data-provider/httpFallback';
import {
  extractContractQueryFromListParams,
  extractQueryFromListParams,
  isBotResource,
  normalizeListResponse,
  resolveResourcePath,
  toContractResourceKind,
} from './data-provider/utils';

function isFinanceOperationsResource(resource: string): boolean {
  return (
    String(resource || '')
      .trim()
      .toLowerCase() === 'finance/operations'
  );
}

function isWriteMethod(method: string): boolean {
  const normalized = String(method || 'GET')
    .trim()
    .toUpperCase();
  return (
    normalized === 'POST' ||
    normalized === 'PUT' ||
    normalized === 'PATCH' ||
    normalized === 'DELETE'
  );
}

export const dataProvider: DataProvider = {
  getList: async <TData extends BaseRecord = BaseRecord>(
    params: GetListParams,
  ): Promise<GetListResponse<TData>> => {
    if (isFinanceOperationsResource(params.resource)) {
      const payload = await listFinanceOperationsViaContract(
        extractContractQueryFromListParams(params),
      );
      return normalizeListResponse(payload as ApiSuccessEnvelope<TData[]>);
    }

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
    const payload = await requestHttpFallback<TData[]>(`${basePath}${query}`);
    return normalizeListResponse(payload);
  },

  getOne: async <TData extends BaseRecord = BaseRecord>(
    params: GetOneParams,
  ): Promise<GetOneResponse<TData>> => {
    if (isFinanceOperationsResource(params.resource)) {
      const payload = await getFinanceOperationViaContract(String(params.id));
      return { data: payload.data as TData };
    }

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
    const payload = await requestHttpFallback<TData>(
      `${basePath}/${encodeURIComponent(String(params.id))}`,
    );
    return { data: payload.data };
  },

  create: async <TData extends BaseRecord = BaseRecord, TVariables = Record<string, unknown>>(
    params: CreateParams<TVariables>,
  ): Promise<CreateResponse<TData>> => {
    assertFrontendWriteAccess(`create:${String(params.resource || 'unknown')}`);

    if (isFinanceOperationsResource(params.resource)) {
      const payload = await createFinanceOperationViaContract(params.variables);
      return { data: payload.data as TData };
    }

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
    const payload = await requestHttpFallback<TData>(basePath, {
      method: 'POST',
      body: JSON.stringify(params.variables || {}),
    });
    return { data: payload.data };
  },

  update: async <TData extends BaseRecord = BaseRecord, TVariables = Record<string, unknown>>(
    params: UpdateParams<TVariables>,
  ): Promise<UpdateResponse<TData>> => {
    assertFrontendWriteAccess(`update:${String(params.resource || 'unknown')}`);

    if (isFinanceOperationsResource(params.resource)) {
      const payload = await patchFinanceOperationViaContract(String(params.id), params.variables);
      return { data: payload.data as TData };
    }

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
    const payload = await requestHttpFallback<TData>(
      `${basePath}/${encodeURIComponent(String(params.id))}`,
      {
        method: 'PATCH',
        body: JSON.stringify(params.variables || {}),
      },
    );
    return { data: payload.data };
  },

  deleteOne: async <TData extends BaseRecord = BaseRecord, TVariables = Record<string, unknown>>(
    params: DeleteOneParams<TVariables>,
  ): Promise<DeleteOneResponse<TData>> => {
    assertFrontendWriteAccess(`delete:${String(params.resource || 'unknown')}`);

    if (isFinanceOperationsResource(params.resource)) {
      await deleteFinanceOperationViaContract(String(params.id));
      return { data: { id: params.id } as TData };
    }

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
    await requestHttpFallback(`${basePath}/${encodeURIComponent(String(params.id))}`, {
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
        const payload = await requestHttpFallback<TData>(
          `${basePath}/${encodeURIComponent(String(id))}`,
        );
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
    if (isWriteMethod(method)) {
      assertFrontendWriteAccess(`custom:${method}:${path}`);
    }
    const payload = await requestHttpFallback<TData>(path, {
      method,
      body: customParams.payload ? JSON.stringify(customParams.payload) : undefined,
    });

    return {
      data: payload.data,
    };
  },
};
