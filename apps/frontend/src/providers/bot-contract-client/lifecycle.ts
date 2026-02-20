import type { ApiSuccessEnvelope } from '../../services/apiClient';
import { createRuntimeClient, resolveAuthorizationHeader, toApiClientError } from './runtime';
import type { BotBanPayload, BotLifecycleTransitionStatus } from './types';

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
