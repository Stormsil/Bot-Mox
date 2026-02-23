import { createApiContractClient } from '@botmox/api-contract';
import { API_BASE_URL } from '../config/env';
import { ApiClientError, type ApiSuccessEnvelope } from '../services/apiClient';
import { withAuthHeaders } from '../services/authFetch';

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

function resolveApiBaseUrl(): string {
  if (API_BASE_URL) {
    return API_BASE_URL;
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  return 'http://localhost:3002';
}

function resolveBearerToken(): string {
  const authorization = withAuthHeaders().get('Authorization') || '';
  return authorization.replace(/^Bearer\s+/i, '').trim();
}

function resolveAuthorizationHeader(): string {
  const token = resolveBearerToken();
  if (!token) {
    throw new ApiClientError('Missing auth token for contract request', {
      status: 401,
      code: 'MISSING_AUTH_TOKEN',
    });
  }

  return `Bearer ${token}`;
}

function createRuntimeClient() {
  return createApiContractClient({
    baseUrl: resolveApiBaseUrl(),
    accessToken: resolveBearerToken(),
  });
}

function toApiClientError(path: string, status: number, body: unknown): ApiClientError {
  const envelope = body && typeof body === 'object' ? (body as { error?: unknown }) : {};
  const payload =
    envelope.error && typeof envelope.error === 'object'
      ? (envelope.error as { code?: unknown; message?: unknown; details?: unknown })
      : {};

  const code = String(payload.code || 'API_CONTRACT_ERROR');
  const rawMessage = String(payload.message || '').trim();
  const normalizedMessage =
    code === 'AGENTS_STORAGE_UNAVAILABLE'
      ? 'Agent pairing storage is not ready yet. Retry after backend startup completes.'
      : code === 'VM_OPS_UNAVAILABLE'
        ? 'VM operations storage is not ready yet. Retry after backend startup completes.'
        : code === 'AGENT_OFFLINE'
          ? 'Agent is offline or not paired yet.'
          : rawMessage || `Contract request failed: ${path}`;

  return new ApiClientError(normalizedMessage, {
    status,
    code,
    details: payload.details ?? body,
  });
}

export async function listAgentsViaContract(
  query: ContractAgentListQuery,
): Promise<ApiSuccessEnvelope<Record<string, unknown>[]>> {
  const client = createRuntimeClient();
  const authorization = resolveAuthorizationHeader();
  const response = await client.agentsList({
    headers: { authorization },
    query,
  });

  if (response.status !== 200) {
    throw toApiClientError('/api/v1/agents', response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<Record<string, unknown>[]>;
}

export async function createAgentPairingViaContract(
  payload: ContractAgentPairingPayload,
): Promise<ApiSuccessEnvelope<Record<string, unknown>>> {
  const client = createRuntimeClient();
  const authorization = resolveAuthorizationHeader();
  const response = await client.agentsCreatePairing({
    headers: { authorization },
    body: payload,
  });

  if (response.status !== 201) {
    throw toApiClientError('/api/v1/agents/pairings', response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<Record<string, unknown>>;
}

export async function dispatchVmOpsViaContract(
  target: VmOpsDispatchTarget,
  action: string,
  payload: ContractVmOpsDispatchPayload,
): Promise<ApiSuccessEnvelope<Record<string, unknown>>> {
  const client = createRuntimeClient();
  const authorization = resolveAuthorizationHeader();
  const endpoint =
    target === 'syncthing' ? client.vmOpsDispatchSyncthing : client.vmOpsDispatchProxmox;
  const response = await endpoint({
    headers: { authorization },
    params: { action },
    body: payload,
  });

  if (response.status !== 200 && response.status !== 202) {
    throw toApiClientError(`/api/v1/vm-ops/${target}/${action}`, response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<Record<string, unknown>>;
}

export async function getVmOpsCommandViaContract(
  commandId: string,
): Promise<ApiSuccessEnvelope<Record<string, unknown>>> {
  const client = createRuntimeClient();
  const authorization = resolveAuthorizationHeader();
  const response = await client.vmOpsCommandById({
    headers: { authorization },
    params: { id: commandId },
  });

  if (response.status !== 200) {
    throw toApiClientError(`/api/v1/vm-ops/commands/${commandId}`, response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<Record<string, unknown>>;
}
