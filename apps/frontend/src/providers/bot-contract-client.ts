import { createApiContractClient } from '@botmox/api-contract';
import { API_BASE_URL } from '../config/env';
import type { BotRecord } from '../entities/bot/model/types';
import { ApiClientError, type ApiSuccessEnvelope } from '../services/apiClient';
import { withAuthHeaders } from '../services/authFetch';

const PAGE_LIMIT = 200;
const MAX_PAGE_COUNT = 100;

interface BotsListQuery {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  q?: string;
}

type BotLifecycleTransitionStatus =
  | 'offline'
  | 'prepare'
  | 'leveling'
  | 'profession'
  | 'farming'
  | 'banned';

interface BotBanPayload {
  ban_date: string;
  ban_reason: string;
  ban_mechanism:
    | 'battlenet_account_closure'
    | 'battlenet_account_suspension'
    | 'game_suspension'
    | 'hardware_ban'
    | 'ip_ban'
    | 'other';
  unbanned_at?: number;
  ban_timestamp?: number;
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

  return new ApiClientError(String(payload.message || `Contract request failed: ${path}`), {
    status,
    code: String(payload.code || 'API_CONTRACT_ERROR'),
    details: payload.details ?? body,
  });
}

function toBotRecord(value: unknown): BotRecord | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  const id = typeof source.id === 'string' ? source.id.trim() : '';
  if (!id) return null;

  return source as unknown as BotRecord;
}

async function listBotsPage(
  query: BotsListQuery,
): Promise<ApiSuccessEnvelope<Record<string, unknown>[]>> {
  return listBotsViaContract(query);
}

export async function listBotsViaContract(
  query: BotsListQuery,
): Promise<ApiSuccessEnvelope<Record<string, unknown>[]>> {
  const client = createRuntimeClient();
  const authorization = resolveAuthorizationHeader();
  const response = await client.botsList({
    headers: { authorization },
    query,
  });

  if (response.status !== 200) {
    throw toApiClientError('/api/v1/bots', response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<Record<string, unknown>[]>;
}

export async function getBotViaContract(
  botId: string,
): Promise<ApiSuccessEnvelope<Record<string, unknown>>> {
  const id = String(botId || '').trim();
  if (!id) {
    throw new Error('botId is required');
  }

  const client = createRuntimeClient();
  const authorization = resolveAuthorizationHeader();
  const response = await client.botsGet({
    headers: { authorization },
    params: { id },
  });

  if (response.status !== 200) {
    throw toApiClientError(`/api/v1/bots/${id}`, response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<Record<string, unknown>>;
}

export async function createBotViaContract(
  payload: Record<string, unknown>,
): Promise<ApiSuccessEnvelope<Record<string, unknown>>> {
  const client = createRuntimeClient();
  const authorization = resolveAuthorizationHeader();
  const response = await client.botsCreate({
    headers: { authorization },
    body: payload,
  });

  if (response.status !== 201) {
    throw toApiClientError('/api/v1/bots', response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<Record<string, unknown>>;
}

export async function fetchBotsListViaContract(): Promise<BotRecord[]> {
  const all: BotRecord[] = [];

  for (let page = 1; page <= MAX_PAGE_COUNT; page += 1) {
    const payload = await listBotsPage({
      page,
      limit: PAGE_LIMIT,
      sort: 'updated_at',
      order: 'desc',
    });
    const items = Array.isArray(payload.data)
      ? payload.data
          .map((item) => toBotRecord(item))
          .filter((item): item is BotRecord => item !== null)
      : [];

    const total = Number(payload.meta?.total ?? items.length);
    const normalizedTotal = Number.isFinite(total) ? total : items.length;

    all.push(...items);

    if (items.length === 0) break;
    if (all.length >= normalizedTotal) break;
    if (items.length < PAGE_LIMIT) break;
  }

  return all;
}

export async function fetchBotByIdViaContract(botId: string): Promise<BotRecord | null> {
  const id = String(botId || '').trim();
  if (!id) return null;

  const client = createRuntimeClient();
  const authorization = resolveAuthorizationHeader();
  const response = await client.botsGet({
    headers: { authorization },
    params: { id },
  });

  if (response.status === 404) {
    return null;
  }

  if (response.status !== 200) {
    throw toApiClientError(`/api/v1/bots/${id}`, response.status, response.body);
  }

  return toBotRecord(response.body?.data ?? null);
}

export async function patchBotViaContract(
  botId: string,
  payload: Record<string, unknown>,
): Promise<ApiSuccessEnvelope<Record<string, unknown>>> {
  const id = String(botId || '').trim();
  if (!id) {
    throw new Error('botId is required');
  }

  const client = createRuntimeClient();
  const authorization = resolveAuthorizationHeader();
  const response = await client.botsPatch({
    headers: { authorization },
    params: { id },
    body: payload,
  });

  if (response.status !== 200) {
    throw toApiClientError(`/api/v1/bots/${id}`, response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<Record<string, unknown>>;
}

export async function deleteBotViaContract(
  botId: string,
): Promise<ApiSuccessEnvelope<{ id: string; deleted: boolean }>> {
  const id = String(botId || '').trim();
  if (!id) {
    throw new Error('botId is required');
  }

  const client = createRuntimeClient();
  const authorization = resolveAuthorizationHeader();
  const response = await client.botsDelete({
    headers: { authorization },
    params: { id },
  });

  if (response.status !== 200) {
    throw toApiClientError(`/api/v1/bots/${id}`, response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<{ id: string; deleted: boolean }>;
}

export async function getBotLifecycleViaContract(
  botId: string,
): Promise<ApiSuccessEnvelope<Record<string, unknown> | null>> {
  const id = String(botId || '').trim();
  if (!id) {
    throw new Error('botId is required');
  }

  const client = createRuntimeClient();
  const authorization = resolveAuthorizationHeader();
  const response = await client.botsLifecycleGet({
    headers: { authorization },
    params: { id },
  });

  if (response.status !== 200) {
    throw toApiClientError(`/api/v1/bots/${id}/lifecycle`, response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<Record<string, unknown> | null>;
}

export async function getBotLifecycleTransitionsViaContract(
  botId: string,
): Promise<ApiSuccessEnvelope<Array<Record<string, unknown>>>> {
  const id = String(botId || '').trim();
  if (!id) {
    throw new Error('botId is required');
  }

  const client = createRuntimeClient();
  const authorization = resolveAuthorizationHeader();
  const response = await client.botsLifecycleTransitions({
    headers: { authorization },
    params: { id },
  });

  if (response.status !== 200) {
    throw toApiClientError(
      `/api/v1/bots/${id}/lifecycle/transitions`,
      response.status,
      response.body,
    );
  }

  return response.body as ApiSuccessEnvelope<Array<Record<string, unknown>>>;
}

export async function isBotBannedViaContract(
  botId: string,
): Promise<ApiSuccessEnvelope<{ banned: boolean }>> {
  const id = String(botId || '').trim();
  if (!id) {
    throw new Error('botId is required');
  }

  const client = createRuntimeClient();
  const authorization = resolveAuthorizationHeader();
  const response = await client.botsLifecycleIsBanned({
    headers: { authorization },
    params: { id },
  });

  if (response.status !== 200) {
    throw toApiClientError(
      `/api/v1/bots/${id}/lifecycle/is-banned`,
      response.status,
      response.body,
    );
  }

  return response.body as ApiSuccessEnvelope<{ banned: boolean }>;
}

export async function transitionBotLifecycleViaContract(
  botId: string,
  status: BotLifecycleTransitionStatus,
): Promise<ApiSuccessEnvelope<Record<string, unknown>>> {
  const id = String(botId || '').trim();
  if (!id) {
    throw new Error('botId is required');
  }

  const client = createRuntimeClient();
  const authorization = resolveAuthorizationHeader();
  const response = await client.botsLifecycleTransition({
    headers: { authorization },
    params: { id },
    body: { status },
  });

  if (response.status !== 200) {
    throw toApiClientError(
      `/api/v1/bots/${id}/lifecycle/transition`,
      response.status,
      response.body,
    );
  }

  return response.body as ApiSuccessEnvelope<Record<string, unknown>>;
}

export async function banBotViaContract(
  botId: string,
  payload: BotBanPayload,
): Promise<ApiSuccessEnvelope<Record<string, unknown>>> {
  const id = String(botId || '').trim();
  if (!id) {
    throw new Error('botId is required');
  }

  const client = createRuntimeClient();
  const authorization = resolveAuthorizationHeader();
  const response = await client.botsLifecycleBan({
    headers: { authorization },
    params: { id },
    body: payload,
  });

  if (response.status !== 200) {
    throw toApiClientError(`/api/v1/bots/${id}/lifecycle/ban`, response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<Record<string, unknown>>;
}

export async function unbanBotViaContract(
  botId: string,
): Promise<ApiSuccessEnvelope<Record<string, unknown>>> {
  const id = String(botId || '').trim();
  if (!id) {
    throw new Error('botId is required');
  }

  const client = createRuntimeClient();
  const authorization = resolveAuthorizationHeader();
  const response = await client.botsLifecycleUnban({
    headers: { authorization },
    params: { id },
    body: {},
  });

  if (response.status !== 200) {
    throw toApiClientError(`/api/v1/bots/${id}/lifecycle/unban`, response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<Record<string, unknown>>;
}
