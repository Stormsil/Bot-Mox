import type { ApiSuccessEnvelope } from '../apiClient';
import { createContractRuntimeClient, toContractApiClientError } from '../contracts/runtimeClient';

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
  const response = await client.wowNamesGet({
    query,
  });

  if (response.status !== 200) {
    throw toContractApiClientError('/api/v1/wow-names', response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<WowNamesPayload>;
}
