import type {
  BotStatus,
  ComputedSubscriptionStatus,
  Subscription,
  SubscriptionFormData,
  SubscriptionWithDetails,
} from '../types';
import { ApiClientError, apiGet } from './apiClient';
import {
  createResource,
  deleteResource,
  fetchResources,
  subscribeResources,
  updateResource,
} from './resourcesApiService';

/**
 * Преобразует дату из формата ДД.ММ.ГГГГ в timestamp
 * Возвращает NaN если дата невалидна
 */
export function parseDateToTimestamp(dateString: string): number {
  if (!dateString || typeof dateString !== 'string') {
    console.error('parseDateToTimestamp: invalid input', { dateString, type: typeof dateString });
    return Number.NaN;
  }

  const parts = dateString.split('.');
  if (parts.length !== 3) {
    console.error('parseDateToTimestamp: invalid format, expected DD.MM.YYYY', { dateString });
    return Number.NaN;
  }

  const [day, month, year] = parts.map(Number);

  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) {
    console.error('parseDateToTimestamp: invalid numbers', { day, month, year, dateString });
    return Number.NaN;
  }

  // Создаем дату в локальном часовом поясе, устанавливаем конец дня.
  const date = new Date(year, month - 1, day, 23, 59, 59, 999);
  const timestamp = date.getTime();

  if (!Number.isFinite(timestamp)) {
    console.error('parseDateToTimestamp: failed to create valid date', { day, month, year, dateString });
    return Number.NaN;
  }

  return timestamp;
}

/**
 * Преобразует timestamp в формат ДД.ММ.ГГГГ
 */
export function formatTimestampToDate(timestamp: number): string {
  const date = new Date(timestamp);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

/**
 * Вычисляет статус подписки на основе даты окончания и настроек
 */
export function calculateSubscriptionStatus(
  subscription: Subscription,
  warningDays: number = 7
): {
  computedStatus: ComputedSubscriptionStatus;
  daysRemaining: number;
  isExpired: boolean;
  isExpiringSoon: boolean;
} {
  const now = Date.now();
  const daysRemaining = Math.ceil((subscription.expires_at - now) / (1000 * 60 * 60 * 24));
  const isExpired = now > subscription.expires_at;
  const isExpiringSoon = daysRemaining <= warningDays && daysRemaining > 0;

  let computedStatus: ComputedSubscriptionStatus;
  if (isExpired) {
    computedStatus = 'expired';
  } else if (isExpiringSoon) {
    computedStatus = 'expiring_soon';
  } else {
    computedStatus = 'active';
  }

  return {
    computedStatus,
    daysRemaining: isExpired ? 0 : Math.max(0, daysRemaining),
    isExpired,
    isExpiringSoon,
  };
}

/**
 * Создает новую подписку
 */
export async function createSubscription(data: SubscriptionFormData): Promise<string> {
  if (!data) {
    throw new Error('Subscription data is required');
  }

  if (!data.bot_id) {
    throw new Error('bot_id is required');
  }

  if (!data.type) {
    throw new Error('type is required');
  }

  if (!data.expires_at) {
    throw new Error('expires_at is required');
  }

  const expiresAtTimestamp = parseDateToTimestamp(data.expires_at);
  if (!Number.isFinite(expiresAtTimestamp)) {
    throw new Error(`Invalid expires_at format: ${data.expires_at}. Expected DD.MM.YYYY`);
  }

  const now = Date.now();
  const subscriptionPayload: Omit<Subscription, 'id'> = {
    type: data.type,
    status: 'active',
    expires_at: expiresAtTimestamp,
    created_at: now,
    updated_at: now,
    bot_id: data.bot_id,
    ...(data.account_email && { account_email: data.account_email }),
    auto_renew: data.auto_renew ?? false,
    ...(data.project_id && { project_id: data.project_id }),
    ...(data.notes && { notes: data.notes }),
  };

  const created = await createResource<Subscription>(
    'subscriptions',
    subscriptionPayload as unknown as Record<string, unknown>
  );

  if (!created?.id) {
    throw new Error('Failed to create subscription');
  }

  return created.id;
}

/**
 * Обновляет существующую подписку
 */
export async function updateSubscription(id: string, data: Partial<SubscriptionFormData>): Promise<void> {
  const updates: Partial<Subscription> = {
    updated_at: Date.now(),
  };

  if (data.type !== undefined) updates.type = data.type;
  if (data.expires_at !== undefined) {
    const expiresAtTimestamp = parseDateToTimestamp(data.expires_at);
    if (!Number.isFinite(expiresAtTimestamp)) {
      throw new Error(`Invalid expires_at format: ${data.expires_at}. Expected DD.MM.YYYY`);
    }
    updates.expires_at = expiresAtTimestamp;
  }
  if (data.bot_id !== undefined) updates.bot_id = data.bot_id;
  if (data.account_email !== undefined) updates.account_email = data.account_email;
  if (data.auto_renew !== undefined) updates.auto_renew = data.auto_renew;
  if (data.project_id !== undefined) updates.project_id = data.project_id;
  if (data.notes !== undefined) updates.notes = data.notes;

  await updateResource<Subscription>('subscriptions', id, updates as unknown as Record<string, unknown>);
}

/**
 * Удаляет подписку
 */
export async function deleteSubscription(id: string): Promise<void> {
  await deleteResource('subscriptions', id);
}

/**
 * Получает все подписки (однократно)
 */
export async function getSubscriptions(): Promise<Subscription[]> {
  return fetchResources<Subscription>('subscriptions');
}

/**
 * Получает подписку по ID (однократно)
 */
export async function getSubscriptionById(id: string): Promise<Subscription | null> {
  try {
    const response = await apiGet<Subscription>(`/api/v1/resources/subscriptions/${encodeURIComponent(String(id || '').trim())}`);
    return response.data || null;
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Получает подписки по ID бота (однократно)
 */
export async function getSubscriptionsByBotId(botId: string): Promise<Subscription[]> {
  const allSubscriptions = await getSubscriptions();
  return allSubscriptions.filter((sub) => sub.bot_id === botId);
}

/**
 * Подписывается на изменения всех подписок
 */
export function subscribeToSubscriptions(
  callback: (subscriptions: Subscription[]) => void,
  onError?: (error: Error) => void
): () => void {
  return subscribeResources<Subscription>('subscriptions', callback, onError, { intervalMs: 6000 });
}

/**
 * Подписывается на изменения подписок конкретного бота
 */
export function subscribeToBotSubscriptions(
  botId: string,
  callback: (subscriptions: Subscription[]) => void,
  onError?: (error: Error) => void
): () => void {
  return subscribeToSubscriptions(
    (subscriptions) => {
      callback(subscriptions.filter((subscription) => subscription.bot_id === botId));
    },
    onError
  );
}

/**
 * Расширяет подписки вычисляемыми полями
 */
export function enrichSubscriptionsWithDetails(
  subscriptions: Subscription[],
  warningDays: number = 7,
  botsMap?: Map<string, { name: string; character?: string; status?: BotStatus; vmName?: string }>
): SubscriptionWithDetails[] {
  return subscriptions.map((subscription) => {
    const statusInfo = calculateSubscriptionStatus(subscription, warningDays);
    const botInfo = botsMap?.get(subscription.bot_id);

    return {
      ...subscription,
      ...statusInfo,
      botName: botInfo?.name,
      botCharacter: botInfo?.character,
      botStatus: botInfo?.status,
      botVmName: botInfo?.vmName,
    };
  });
}
