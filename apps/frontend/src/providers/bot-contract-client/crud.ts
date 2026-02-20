import type { BotRecord } from '../../entities/bot/model/types';
import type { ApiSuccessEnvelope } from '../../services/apiClient';
import {
  createRuntimeClient,
  resolveAuthorizationHeader,
  toApiClientError,
  toBotRecord,
} from './runtime';
import { type BotsListQuery, MAX_PAGE_COUNT, PAGE_LIMIT } from './types';

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
