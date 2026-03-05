import { resourcesStatusAggregateSchema } from '@botmox/api-contract';
import type { ApiSuccessEnvelope } from '../apiClient';
import { createContractRuntimeClient, toContractApiClientError } from '../contracts/runtimeClient';

export type ContractResourceKind = 'licenses' | 'proxies' | 'subscriptions';

interface ResourceListQuery {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  q?: string;
  status?: string;
  type?: string;
  country?: string;
  country_code?: string;
  bot_id?: string;
}

export type ResourcesStatusAggregateContractRecord = ReturnType<
  typeof resourcesStatusAggregateSchema.parse
>;

export async function listResourcesViaContract(
  kind: ContractResourceKind,
  query: ResourceListQuery,
): Promise<ApiSuccessEnvelope<Record<string, unknown>[]>> {
  const client = createContractRuntimeClient();
  const response = await client.resourcesList({
    params: { kind },
    query,
  });

  if (response.status !== 200) {
    throw toContractApiClientError(`/api/v1/resources/${kind}`, response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<Record<string, unknown>[]>;
}

export async function getResourcesStatusAggregateViaContract(): Promise<
  ApiSuccessEnvelope<ResourcesStatusAggregateContractRecord>
> {
  const client = createContractRuntimeClient();
  const response = await client.resourcesStatusAggregate({});

  if (response.status !== 200) {
    throw toContractApiClientError(
      '/api/v1/resources/status-aggregate',
      response.status,
      response.body,
    );
  }

  return {
    success: true,
    data: resourcesStatusAggregateSchema.parse(response.body.data),
    ...(response.body.meta ? { meta: response.body.meta } : {}),
  };
}

export async function upsertResourceViaContract(
  kind: ContractResourceKind,
  id: string,
  payload: Record<string, unknown>,
): Promise<ApiSuccessEnvelope<Record<string, unknown>>> {
  return updateResourceViaContract(kind, id, payload);
}

export async function getResourceViaContract(
  kind: ContractResourceKind,
  id: string,
): Promise<ApiSuccessEnvelope<Record<string, unknown>>> {
  const client = createContractRuntimeClient();
  const response = await client.resourcesGet({
    params: { kind, id },
  });

  if (response.status !== 200) {
    throw toContractApiClientError(
      `/api/v1/resources/${kind}/${id}`,
      response.status,
      response.body,
    );
  }

  return response.body as ApiSuccessEnvelope<Record<string, unknown>>;
}

export async function createResourceViaContract(
  kind: ContractResourceKind,
  payload: Record<string, unknown>,
): Promise<ApiSuccessEnvelope<Record<string, unknown>>> {
  const client = createContractRuntimeClient();
  const response = await client.resourcesCreate({
    params: { kind },
    body: payload,
  });

  if (response.status !== 201) {
    throw toContractApiClientError(`/api/v1/resources/${kind}`, response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<Record<string, unknown>>;
}

export async function updateResourceViaContract(
  kind: ContractResourceKind,
  id: string,
  payload: Record<string, unknown>,
): Promise<ApiSuccessEnvelope<Record<string, unknown>>> {
  const client = createContractRuntimeClient();
  const response = await client.resourcesUpdate({
    params: { kind, id },
    body: payload,
  });

  if (response.status !== 200) {
    throw toContractApiClientError(
      `/api/v1/resources/${kind}/${id}`,
      response.status,
      response.body,
    );
  }

  return response.body as ApiSuccessEnvelope<Record<string, unknown>>;
}

export async function deleteResourceViaContract(
  kind: ContractResourceKind,
  id: string,
): Promise<ApiSuccessEnvelope<{ id: string; deleted: boolean }>> {
  const client = createContractRuntimeClient();
  const response = await client.resourcesDelete({
    params: { kind, id },
  });

  if (response.status !== 200) {
    throw toContractApiClientError(
      `/api/v1/resources/${kind}/${id}`,
      response.status,
      response.body,
    );
  }

  return response.body as ApiSuccessEnvelope<{ id: string; deleted: boolean }>;
}
