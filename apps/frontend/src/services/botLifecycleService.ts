import {
  banBotViaContract,
  getBotLifecycleTransitionsViaContract,
  getBotLifecycleViaContract,
  isBotBannedViaContract,
  transitionBotLifecycleViaContract,
  unbanBotViaContract,
} from '../providers/bot-contract-client';
import type { BanDetails, BotLifecycle, BotStatus } from '../types';

function normalizeLifecycle(value: unknown): BotLifecycle | null {
  if (!value || typeof value !== 'object') return null;
  return value as BotLifecycle;
}

/**
 * Автоматический переход статуса бота.
 */
export const transitionBotStatus = async (botId: string, newStatus: BotStatus): Promise<void> => {
  if (!botId) {
    throw new Error('botId is required');
  }

  await transitionBotLifecycleViaContract(botId, newStatus);
};

/**
 * Бан бота.
 */
export const banBot = async (botId: string, banDetails: BanDetails): Promise<void> => {
  if (!botId) {
    throw new Error('botId is required');
  }

  if (!banDetails.ban_date || !banDetails.ban_reason || !banDetails.ban_mechanism) {
    throw new Error('ban_date, ban_reason, and ban_mechanism are required');
  }

  await banBotViaContract(botId, banDetails);
};

/**
 * Снятие бана с бота.
 */
export const unbanBot = async (botId: string): Promise<void> => {
  if (!botId) {
    throw new Error('botId is required');
  }

  await unbanBotViaContract(botId);
};

/**
 * Получает текущий lifecycle бота.
 */
export const getBotLifecycle = async (botId: string): Promise<BotLifecycle | null> => {
  if (!botId) {
    throw new Error('botId is required');
  }

  const response = await getBotLifecycleViaContract(botId);
  return normalizeLifecycle(response.data);
};

/**
 * Проверяет забанен ли бот.
 */
export const isBotBanned = async (botId: string): Promise<boolean> => {
  if (!botId) {
    throw new Error('botId is required');
  }

  const response = await isBotBannedViaContract(botId);
  return Boolean(response.data?.banned);
};

/**
 * Получает историю переходов статусов бота.
 */
export const getStageTransitions = async (
  botId: string,
): Promise<BotLifecycle['stage_transitions']> => {
  if (!botId) {
    throw new Error('botId is required');
  }

  const response = await getBotLifecycleTransitionsViaContract(botId);

  return Array.isArray(response.data) ? (response.data as BotLifecycle['stage_transitions']) : [];
};

/**
 * Форматирует дату из DD.MM.YYYY в timestamp.
 */
export function parseRussianDate(russianDate: string): number {
  const [day, month, year] = russianDate.split('.').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getTime();
}
