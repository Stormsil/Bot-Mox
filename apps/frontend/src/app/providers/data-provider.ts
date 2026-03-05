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
  createResourceHandlerResolver,
  DataProviderRegistryError,
  getRegisteredHandlerOrThrow,
  type PartialProviderMethodHandlers,
  type ProviderMethodHandlers,
  type ProviderMethodName,
  type ResourceHandlerRegistration,
} from './data-provider/registry';
import {
  extractContractQueryFromListParams,
  extractQueryFromListParams,
  normalizeListResponse,
  resolveResourcePath,
  toContractResourceKind,
} from './data-provider/utils';

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

const financeHandlers: PartialProviderMethodHandlers = {
  getList: async <TData extends BaseRecord = BaseRecord>(
    params: GetListParams,
  ): Promise<GetListResponse<TData>> => {
    const payload = await listFinanceOperationsViaContract(
      extractContractQueryFromListParams(params),
    );
    return normalizeListResponse(payload as ApiSuccessEnvelope<TData[]>);
  },
  getOne: async <TData extends BaseRecord = BaseRecord>(
    params: GetOneParams,
  ): Promise<GetOneResponse<TData>> => {
    const payload = await getFinanceOperationViaContract(String(params.id));
    return { data: payload.data as TData };
  },
  create: async <TData extends BaseRecord = BaseRecord, TVariables = Record<string, unknown>>(
    params: CreateParams<TVariables>,
  ): Promise<CreateResponse<TData>> => {
    const payload = await createFinanceOperationViaContract(params.variables);
    return { data: payload.data as TData };
  },
  update: async <TData extends BaseRecord = BaseRecord, TVariables = Record<string, unknown>>(
    params: UpdateParams<TVariables>,
  ): Promise<UpdateResponse<TData>> => {
    const payload = await patchFinanceOperationViaContract(String(params.id), params.variables);
    return { data: payload.data as TData };
  },
  deleteOne: async <TData extends BaseRecord = BaseRecord, TVariables = Record<string, unknown>>(
    params: DeleteOneParams<TVariables>,
  ): Promise<DeleteOneResponse<TData>> => {
    await deleteFinanceOperationViaContract(String(params.id));
    return { data: { id: params.id } as TData };
  },
};

const botHandlers: PartialProviderMethodHandlers = {
  getList: async <TData extends BaseRecord = BaseRecord>(
    params: GetListParams,
  ): Promise<GetListResponse<TData>> => {
    const payload = await listBotsViaContract(extractContractQueryFromListParams(params));
    return normalizeListResponse(payload as ApiSuccessEnvelope<TData[]>);
  },
  getOne: async <TData extends BaseRecord = BaseRecord>(
    params: GetOneParams,
  ): Promise<GetOneResponse<TData>> => {
    const payload = await getBotViaContract(String(params.id));
    return { data: payload.data as TData };
  },
  create: async <TData extends BaseRecord = BaseRecord, TVariables = Record<string, unknown>>(
    params: CreateParams<TVariables>,
  ): Promise<CreateResponse<TData>> => {
    const payload = await createBotViaContract({
      ...(params.variables as Record<string, unknown> | undefined),
    });
    return { data: payload.data as TData };
  },
  update: async <TData extends BaseRecord = BaseRecord, TVariables = Record<string, unknown>>(
    params: UpdateParams<TVariables>,
  ): Promise<UpdateResponse<TData>> => {
    const payload = await patchBotViaContract(String(params.id), {
      ...(params.variables as Record<string, unknown> | undefined),
    });
    return { data: payload.data as TData };
  },
  deleteOne: async <TData extends BaseRecord = BaseRecord, TVariables = Record<string, unknown>>(
    params: DeleteOneParams<TVariables>,
  ): Promise<DeleteOneResponse<TData>> => {
    await deleteBotViaContract(String(params.id));
    return { data: { id: params.id } as TData };
  },
  getMany: async <TData extends BaseRecord = BaseRecord>(
    params: GetManyParams,
  ): Promise<GetManyResponse<TData>> => {
    const items = await Promise.all(
      params.ids.map(async (id) => {
        const payload = await getBotViaContract(String(id));
        return payload.data as TData;
      }),
    );
    return { data: items };
  },
};

const contractHandlers: PartialProviderMethodHandlers = {
  getList: async <TData extends BaseRecord = BaseRecord>(
    params: GetListParams,
  ): Promise<GetListResponse<TData>> => {
    const contractKind = toContractResourceKind(params.resource);
    if (!contractKind) {
      throw new Error(`Unsupported contract resource: ${String(params.resource || '')}`);
    }
    const payload = await listResourcesViaContract(
      contractKind,
      extractContractQueryFromListParams(params),
    );
    return normalizeListResponse(payload as ApiSuccessEnvelope<TData[]>);
  },
  getOne: async <TData extends BaseRecord = BaseRecord>(
    params: GetOneParams,
  ): Promise<GetOneResponse<TData>> => {
    const contractKind = toContractResourceKind(params.resource);
    if (!contractKind) {
      throw new Error(`Unsupported contract resource: ${String(params.resource || '')}`);
    }
    const payload = await getResourceViaContract(contractKind, String(params.id));
    return { data: payload.data as TData };
  },
  create: async <TData extends BaseRecord = BaseRecord, TVariables = Record<string, unknown>>(
    params: CreateParams<TVariables>,
  ): Promise<CreateResponse<TData>> => {
    const contractKind = toContractResourceKind(params.resource);
    if (!contractKind) {
      throw new Error(`Unsupported contract resource: ${String(params.resource || '')}`);
    }
    const payload = await createResourceViaContract(contractKind, {
      ...(params.variables as Record<string, unknown> | undefined),
    });
    return { data: payload.data as TData };
  },
  update: async <TData extends BaseRecord = BaseRecord, TVariables = Record<string, unknown>>(
    params: UpdateParams<TVariables>,
  ): Promise<UpdateResponse<TData>> => {
    const contractKind = toContractResourceKind(params.resource);
    if (!contractKind) {
      throw new Error(`Unsupported contract resource: ${String(params.resource || '')}`);
    }
    const payload = await updateResourceViaContract(contractKind, String(params.id), {
      ...(params.variables as Record<string, unknown> | undefined),
    });
    return { data: payload.data as TData };
  },
  deleteOne: async <TData extends BaseRecord = BaseRecord, TVariables = Record<string, unknown>>(
    params: DeleteOneParams<TVariables>,
  ): Promise<DeleteOneResponse<TData>> => {
    const contractKind = toContractResourceKind(params.resource);
    if (!contractKind) {
      throw new Error(`Unsupported contract resource: ${String(params.resource || '')}`);
    }
    await deleteResourceViaContract(contractKind, String(params.id));
    return { data: { id: params.id } as TData };
  },
  getMany: async <TData extends BaseRecord = BaseRecord>(
    params: GetManyParams,
  ): Promise<GetManyResponse<TData>> => {
    const contractKind = toContractResourceKind(params.resource);
    if (!contractKind) {
      throw new Error(`Unsupported contract resource: ${String(params.resource || '')}`);
    }
    const items = await Promise.all(
      params.ids.map(async (id) => {
        const payload = await getResourceViaContract(contractKind, String(id));
        return payload.data as TData;
      }),
    );
    return { data: items };
  },
};

const fallbackHandlers: PartialProviderMethodHandlers = {
  getList: async <TData extends BaseRecord = BaseRecord>(
    params: GetListParams,
  ): Promise<GetListResponse<TData>> => {
    const basePath = resolveResourcePath(params.resource);
    const query = extractQueryFromListParams(params);
    const payload = await requestHttpFallback<TData[]>(`${basePath}${query}`);
    return normalizeListResponse(payload);
  },
  getOne: async <TData extends BaseRecord = BaseRecord>(
    params: GetOneParams,
  ): Promise<GetOneResponse<TData>> => {
    const basePath = resolveResourcePath(params.resource);
    const payload = await requestHttpFallback<TData>(
      `${basePath}/${encodeURIComponent(String(params.id))}`,
    );
    return { data: payload.data };
  },
  create: async <TData extends BaseRecord = BaseRecord, TVariables = Record<string, unknown>>(
    params: CreateParams<TVariables>,
  ): Promise<CreateResponse<TData>> => {
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
    const basePath = resolveResourcePath(params.resource);
    await requestHttpFallback(`${basePath}/${encodeURIComponent(String(params.id))}`, {
      method: 'DELETE',
    });
    return { data: { id: params.id } as TData };
  },
  getMany: async <TData extends BaseRecord = BaseRecord>(
    params: GetManyParams,
  ): Promise<GetManyResponse<TData>> => {
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
};

const resourceRegistrations: ResourceHandlerRegistration[] = [
  {
    resource: 'finance/operations',
    label: 'finance:operations:contract',
    handlers: financeHandlers,
  },
  {
    resource: 'bots',
    label: 'bots:contract',
    handlers: botHandlers,
  },
  {
    resource: 'licenses',
    aliases: ['proxies', 'subscriptions'],
    label: 'resources:contract',
    handlers: contractHandlers,
  },
];

const resolveResourceHandlers = createResourceHandlerResolver(resourceRegistrations, {
  resource: '__fallback__',
  label: 'http:fallback',
  handlers: fallbackHandlers,
});

const fallbackWriteResources = new Set([
  'notes',
  'notes_v2',
  'calendar',
  'calendar_events',
  'kanban',
  'kanban_tasks',
  'settings',
]);

function assertRegisteredWriteRouting(
  method: ProviderMethodName,
  normalizedResource: string,
): void {
  if (method !== 'create' && method !== 'update' && method !== 'deleteOne') {
    return;
  }
  if (fallbackWriteResources.has(normalizedResource)) {
    return;
  }
  throw new DataProviderRegistryError(
    `No registered write handler for resource "${normalizedResource}" and method "${method}"`,
  );
}

function getMethodHandler<TMethod extends ProviderMethodName>(
  method: TMethod,
  resource: string,
  options?: { allowFallbackOnMissing?: boolean },
): ProviderMethodHandlers[TMethod] {
  const resolved = resolveResourceHandlers(resource);

  if (resolved.label === 'http:fallback') {
    assertRegisteredWriteRouting(method, resolved.normalizedResource);
  }

  if (resolved.handlers[method]) {
    return getRegisteredHandlerOrThrow(resolved, method);
  }

  if (options?.allowFallbackOnMissing && fallbackHandlers[method]) {
    return getRegisteredHandlerOrThrow(
      {
        normalizedResource: resolved.normalizedResource,
        label: 'http:fallback',
        handlers: fallbackHandlers,
      },
      method,
    );
  }

  return getRegisteredHandlerOrThrow(resolved, method);
}

export const dataProvider: DataProvider = {
  getList: async <TData extends BaseRecord = BaseRecord>(
    params: GetListParams,
  ): Promise<GetListResponse<TData>> => {
    const handler = getMethodHandler('getList', params.resource);
    return handler<TData>(params);
  },

  getOne: async <TData extends BaseRecord = BaseRecord>(
    params: GetOneParams,
  ): Promise<GetOneResponse<TData>> => {
    const handler = getMethodHandler('getOne', params.resource);
    return handler<TData>(params);
  },

  create: async <TData extends BaseRecord = BaseRecord, TVariables = Record<string, unknown>>(
    params: CreateParams<TVariables>,
  ): Promise<CreateResponse<TData>> => {
    assertFrontendWriteAccess(`create:${String(params.resource || 'unknown')}`);
    const handler = getMethodHandler('create', params.resource);
    return handler<TData, TVariables>(params);
  },

  update: async <TData extends BaseRecord = BaseRecord, TVariables = Record<string, unknown>>(
    params: UpdateParams<TVariables>,
  ): Promise<UpdateResponse<TData>> => {
    assertFrontendWriteAccess(`update:${String(params.resource || 'unknown')}`);
    const handler = getMethodHandler('update', params.resource);
    return handler<TData, TVariables>(params);
  },

  deleteOne: async <TData extends BaseRecord = BaseRecord, TVariables = Record<string, unknown>>(
    params: DeleteOneParams<TVariables>,
  ): Promise<DeleteOneResponse<TData>> => {
    assertFrontendWriteAccess(`delete:${String(params.resource || 'unknown')}`);
    const handler = getMethodHandler('deleteOne', params.resource);
    return handler<TData, TVariables>(params);
  },

  getMany: async <TData extends BaseRecord = BaseRecord>(
    params: GetManyParams,
  ): Promise<GetManyResponse<TData>> => {
    const handler = getMethodHandler('getMany', params.resource, {
      allowFallbackOnMissing: true,
    });
    return handler<TData>(params);
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
