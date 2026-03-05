import type {
  BaseRecord,
  CreateParams,
  CreateResponse,
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
import { normalizeResourceKey } from './utils';

export type ProviderMethodName =
  | 'getList'
  | 'getOne'
  | 'create'
  | 'update'
  | 'deleteOne'
  | 'getMany';

export interface ProviderMethodHandlers {
  getList: <TData extends BaseRecord = BaseRecord>(
    params: GetListParams,
  ) => Promise<GetListResponse<TData>>;
  getOne: <TData extends BaseRecord = BaseRecord>(
    params: GetOneParams,
  ) => Promise<GetOneResponse<TData>>;
  create: <TData extends BaseRecord = BaseRecord, TVariables = Record<string, unknown>>(
    params: CreateParams<TVariables>,
  ) => Promise<CreateResponse<TData>>;
  update: <TData extends BaseRecord = BaseRecord, TVariables = Record<string, unknown>>(
    params: UpdateParams<TVariables>,
  ) => Promise<UpdateResponse<TData>>;
  deleteOne: <TData extends BaseRecord = BaseRecord, TVariables = Record<string, unknown>>(
    params: DeleteOneParams<TVariables>,
  ) => Promise<DeleteOneResponse<TData>>;
  getMany: <TData extends BaseRecord = BaseRecord>(
    params: GetManyParams,
  ) => Promise<GetManyResponse<TData>>;
}

export type PartialProviderMethodHandlers = Partial<ProviderMethodHandlers>;

export interface ResourceHandlerRegistration {
  resource: string;
  aliases?: string[];
  label: string;
  handlers: PartialProviderMethodHandlers;
}

export interface ResolvedResourceHandlers {
  normalizedResource: string;
  label: string;
  handlers: PartialProviderMethodHandlers;
}

export class DataProviderRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DataProviderRegistryError';
  }
}

export function createResourceHandlerResolver(
  registrations: readonly ResourceHandlerRegistration[],
  fallback: ResourceHandlerRegistration,
): (resource: string) => ResolvedResourceHandlers {
  const registry = new Map<string, ResourceHandlerRegistration>();

  for (const registration of registrations) {
    const keys = [registration.resource, ...(registration.aliases || [])];
    for (const key of keys) {
      registry.set(normalizeResourceKey(key), registration);
    }
  }

  return (resource: string): ResolvedResourceHandlers => {
    const normalizedResource = normalizeResourceKey(resource);
    if (!normalizedResource) {
      throw new DataProviderRegistryError('Resource key is required for data provider routing');
    }

    const registration = registry.get(normalizedResource) || fallback;

    return {
      normalizedResource,
      label: registration.label,
      handlers: registration.handlers,
    };
  };
}

export function getRegisteredHandlerOrThrow<TMethod extends ProviderMethodName>(
  resolved: ResolvedResourceHandlers,
  method: TMethod,
): ProviderMethodHandlers[TMethod] {
  const handler = resolved.handlers[method] as ProviderMethodHandlers[TMethod] | undefined;
  if (handler) {
    return handler;
  }

  throw new DataProviderRegistryError(
    `No registered handler for method "${method}" on resource "${resolved.normalizedResource}" (${resolved.label})`,
  );
}
