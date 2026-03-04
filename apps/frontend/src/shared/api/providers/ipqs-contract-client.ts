import type { IPQSResponse } from '../../../entities/resources/model/types';
import type { ApiSuccessEnvelope } from '../apiClient';
import { createContractRuntimeClient, toContractApiClientError } from '../contracts/runtimeClient';

interface IpqsStatusPayload {
  enabled?: unknown;
  configured?: unknown;
  supabaseSettingsConnected?: unknown;
}

interface IpqsBatchPayload {
  results: Array<{
    ip: string;
    success: boolean;
    data?: IPQSResponse;
    error?: string;
    details?: unknown;
  }>;
}

export async function getIpqsStatusViaContract(): Promise<ApiSuccessEnvelope<IpqsStatusPayload>> {
  const client = createContractRuntimeClient();
  const response = await client.ipqsStatusGet({});

  if (response.status !== 200) {
    throw toContractApiClientError('/api/v1/ipqs/status', response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<IpqsStatusPayload>;
}

export async function checkIpqsViaContract(ip: string): Promise<ApiSuccessEnvelope<IPQSResponse>> {
  const client = createContractRuntimeClient();
  const response = await client.ipqsCheck({
    body: { ip },
  });

  if (response.status !== 200) {
    throw toContractApiClientError('/api/v1/ipqs/check', response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<IPQSResponse>;
}

export async function checkIpqsBatchViaContract(
  ips: string[],
): Promise<ApiSuccessEnvelope<IpqsBatchPayload>> {
  const client = createContractRuntimeClient();
  const response = await client.ipqsCheckBatch({
    body: { ips },
  });

  if (response.status !== 200) {
    throw toContractApiClientError('/api/v1/ipqs/check-batch', response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<IpqsBatchPayload>;
}
