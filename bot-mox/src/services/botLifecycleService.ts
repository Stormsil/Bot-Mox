import { apiGet, apiPost } from './apiClient';
import type {
  BanDetails,
  BotLifecycle,
  BotStatus,
} from '../types';

interface LifecycleTransitionsPayload {
  data?: BotLifecycle['stage_transitions'];
}

interface IsBannedPayload {
  data?: {
    banned?: boolean;
  };
}

function normalizeLifecycle(value: unknown): BotLifecycle | null {
  if (!value || typeof value !== 'object') return null;
  return value as BotLifecycle;
}

/**
 * Автоматический переход статуса бота.
 */
export const transitionBotStatus = async (
  botId: string,
  newStatus: BotStatus
): Promise<void> => {
  if (!botId) {
    throw new Error('botId is required');
  }

  await apiPost(`/api/v1/bots/${encodeURIComponent(botId)}/lifecycle/transition`, {
    status: newStatus,
  });
};

/**
 * Бан бота.
 */
export const banBot = async (
  botId: string,
  banDetails: BanDetails
): Promise<void> => {
  if (!botId) {
    throw new Error('botId is required');
  }

  if (!banDetails.ban_date || !banDetails.ban_reason || !banDetails.ban_mechanism) {
    throw new Error('ban_date, ban_reason, and ban_mechanism are required');
  }

  await apiPost(`/api/v1/bots/${encodeURIComponent(botId)}/lifecycle/ban`, banDetails);
};

/**
 * Снятие бана с бота.
 */
export const unbanBot = async (botId: string): Promise<void> => {
  if (!botId) {
    throw new Error('botId is required');
  }

  await apiPost(`/api/v1/bots/${encodeURIComponent(botId)}/lifecycle/unban`, {});
};

/**
 * Получает текущий lifecycle бота.
 */
export const getBotLifecycle = async (botId: string): Promise<BotLifecycle | null> => {
  if (!botId) {
    throw new Error('botId is required');
  }

  const response = await apiGet<BotLifecycle | null>(`/api/v1/bots/${encodeURIComponent(botId)}/lifecycle`);
  return normalizeLifecycle(response.data);
};

/**
 * Проверяет забанен ли бот.
 */
export const isBotBanned = async (botId: string): Promise<boolean> => {
  if (!botId) {
    throw new Error('botId is required');
  }

  const response = await apiGet<IsBannedPayload['data']>(
    `/api/v1/bots/${encodeURIComponent(botId)}/lifecycle/is-banned`
  );
  return Boolean(response.data?.banned);
};

/**
 * Получает историю переходов статусов бота.
 */
export const getStageTransitions = async (botId: string): Promise<BotLifecycle['stage_transitions']> => {
  if (!botId) {
    throw new Error('botId is required');
  }

  const response = await apiGet<LifecycleTransitionsPayload['data']>(
    `/api/v1/bots/${encodeURIComponent(botId)}/lifecycle/transitions`
  );

  return Array.isArray(response.data) ? response.data : [];
};

/**
 * Форматирует дату из DD.MM.YYYY в timestamp.
 */
export function parseRussianDate(russianDate: string): number {
  const [day, month, year] = russianDate.split('.').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getTime();
}
