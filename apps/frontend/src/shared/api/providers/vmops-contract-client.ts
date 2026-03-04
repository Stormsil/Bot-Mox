import type { ApiSuccessEnvelope } from '../apiClient';
import { createContractRuntimeClient, toContractApiClientError } from '../contracts/runtimeClient';

export type VmOpsDispatchTarget = 'proxmox' | 'syncthing';

export interface ContractAgentListQuery {
  status?: 'pending' | 'active' | 'offline' | 'revoked';
}

export interface ContractAgentPairingPayload {
  name?: string;
  expires_in_minutes?: number;
}

export interface ContractVmOpsDispatchPayload {
  agent_id: string;
  params?: Record<string, unknown>;
}

export async function listAgentsViaContract(
  query: ContractAgentListQuery,
): Promise<ApiSuccessEnvelope<Record<string, unknown>[]>> {
  const client = createContractRuntimeClient();
  const response = await client.agentsList({
    query,
  });

  if (response.status !== 200) {
    throw toContractApiClientError('/api/v1/agents', response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<Record<string, unknown>[]>;
}

export async function createAgentPairingViaContract(
  payload: ContractAgentPairingPayload,
): Promise<ApiSuccessEnvelope<Record<string, unknown>>> {
  const client = createContractRuntimeClient();
  const response = await client.agentsCreatePairing({
    body: payload,
  });

  if (response.status !== 201) {
    throw toContractApiClientError('/api/v1/agents/pairings', response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<Record<string, unknown>>;
}

export async function dispatchVmOpsViaContract(
  target: VmOpsDispatchTarget,
  action: string,
  payload: ContractVmOpsDispatchPayload,
): Promise<ApiSuccessEnvelope<Record<string, unknown>>> {
  const client = createContractRuntimeClient();
  const endpoint =
    target === 'syncthing' ? client.vmOpsDispatchSyncthing : client.vmOpsDispatchProxmox;
  const response = await endpoint({
    params: { action },
    body: payload,
  });

  if (response.status !== 200 && response.status !== 202) {
    throw toContractApiClientError(
      `/api/v1/vm-ops/${target}/${action}`,
      response.status,
      response.body,
    );
  }

  return response.body as ApiSuccessEnvelope<Record<string, unknown>>;
}

export async function getVmOpsCommandViaContract(
  commandId: string,
): Promise<ApiSuccessEnvelope<Record<string, unknown>>> {
  const client = createContractRuntimeClient();
  const response = await client.vmOpsCommandById({
    params: { id: commandId },
  });

  if (response.status !== 200) {
    throw toContractApiClientError(
      `/api/v1/vm-ops/commands/${commandId}`,
      response.status,
      response.body,
    );
  }

  return response.body as ApiSuccessEnvelope<Record<string, unknown>>;
}
