import type { ApiSuccessEnvelope } from '../shared/api/apiClient';
import {
  createContractRuntimeClient,
  resolveContractAuthorizationHeader,
  toContractApiClientError,
} from '../shared/api/contracts/runtimeClient';

interface WowNamesQuery {
  batches?: number;
  count?: number;
}

type WowNamesPayload = {
  names: string[];
  random?: string;
  source?: string;
  batches?: number;
} & Record<string, unknown>;

export async function getWowNamesViaContract(
  query: WowNamesQuery,
): Promise<ApiSuccessEnvelope<WowNamesPayload>> {
  const client = createContractRuntimeClient();
  const authorization = resolveContractAuthorizationHeader();
  const response = await client.wowNamesGet({
    headers: { authorization },
    query,
  });

  if (response.status !== 200) {
    throw toContractApiClientError('/api/v1/wow-names', response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<WowNamesPayload>;
}
