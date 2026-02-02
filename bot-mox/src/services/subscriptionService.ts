import { ref, push, set, update, remove, onValue, off } from 'firebase/database';
import { database } from '../utils/firebase';
import type {
  Subscription,
  SubscriptionFormData,
  SubscriptionWithDetails,
  ComputedSubscriptionStatus,
  SubscriptionSettings,
} from '../types';

const SUBSCRIPTIONS_PATH = 'subscriptions';

/**
 * Преобразует дату из формата ДД.ММ.ГГГГ в timestamp
 * Возвращает NaN если дата невалидна
 */
export function parseDateToTimestamp(dateString: string): number {
  // Проверка входных данных
  if (!dateString || typeof dateString !== 'string') {
    console.error('parseDateToTimestamp: invalid input', { dateString, type: typeof dateString });
    return NaN;
  }
  
  const parts = dateString.split('.');
  if (parts.length !== 3) {
    console.error('parseDateToTimestamp: invalid format, expected DD.MM.YYYY', { dateString });
    return NaN;
  }
  
  const [day, month, year] = parts.map(Number);
  
  // Проверка на валидность чисел
  if (isNaN(day) || isNaN(month) || isNaN(year)) {
    console.error('parseDateToTimestamp: invalid numbers', { day, month, year, dateString });
    return NaN;
  }
  
  // Создаем дату в локальном часовом поясе, устанавливаем конец дня
  const date = new Date(year, month - 1, day, 23, 59, 59, 999);
  const timestamp = date.getTime();
  
  // Проверка на валидность результата
  if (isNaN(timestamp)) {
    console.error('parseDateToTimestamp: failed to create valid date', { day, month, year, dateString });
    return NaN;
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
export async function createSubscription(
  data: SubscriptionFormData
): Promise<string> {
  // Валидация входных данных
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
  if (isNaN(expiresAtTimestamp)) {
    throw new Error(`Invalid expires_at format: ${data.expires_at}. Expected DD.MM.YYYY`);
  }
  
  const subscriptionsRef = ref(database, SUBSCRIPTIONS_PATH);
  const newSubscriptionRef = push(subscriptionsRef);
  const id = newSubscriptionRef.key;

  if (!id) {
    throw new Error('Failed to generate subscription ID');
  }

  const subscription: Omit<Subscription, 'id'> = {
    type: data.type,
    status: 'active',
    expires_at: expiresAtTimestamp,
    created_at: Date.now(),
    updated_at: Date.now(),
    bot_id: data.bot_id,
    ...(data.account_email && { account_email: data.account_email }),
    auto_renew: data.auto_renew ?? false,
    ...(data.project_id && { project_id: data.project_id }),
    ...(data.notes && { notes: data.notes }),
  };
  
  console.log('Creating subscription object:', subscription);

  try {
    await set(newSubscriptionRef, subscription);
    console.log('Subscription created successfully with ID:', id);
    return id;
  } catch (firebaseError) {
    console.error('Firebase error creating subscription:', firebaseError);
    throw new Error(`Firebase error: ${(firebaseError as Error).message}`);
  }
}

/**
 * Обновляет существующую подписку
 */
export async function updateSubscription(
  id: string,
  data: Partial<SubscriptionFormData>
): Promise<void> {
  const subscriptionRef = ref(database, `${SUBSCRIPTIONS_PATH}/${id}`);

  const updates: Partial<Subscription> = {
    updated_at: Date.now(),
  };

  if (data.type !== undefined) updates.type = data.type;
  if (data.expires_at !== undefined) {
    updates.expires_at = parseDateToTimestamp(data.expires_at);
  }
  if (data.bot_id !== undefined) updates.bot_id = data.bot_id;
  if (data.account_email !== undefined) updates.account_email = data.account_email;
  if (data.auto_renew !== undefined) updates.auto_renew = data.auto_renew;
  if (data.project_id !== undefined) updates.project_id = data.project_id;
  if (data.notes !== undefined) updates.notes = data.notes;

  await update(subscriptionRef, updates);
}

/**
 * Удаляет подписку
 */
export async function deleteSubscription(id: string): Promise<void> {
  const subscriptionRef = ref(database, `${SUBSCRIPTIONS_PATH}/${id}`);
  await remove(subscriptionRef);
}

/**
 * Получает все подписки (однократно)
 */
export async function getSubscriptions(): Promise<Subscription[]> {
  return new Promise((resolve, reject) => {
    const subscriptionsRef = ref(database, SUBSCRIPTIONS_PATH);

    onValue(
      subscriptionsRef,
      (snapshot) => {
        const data = snapshot.val();
        if (!data) {
          resolve([]);
          return;
        }

        const subscriptions: Subscription[] = Object.entries(data).map(([id, value]) => ({
          id,
          ...(value as Omit<Subscription, 'id'>),
        }));

        resolve(subscriptions);
      },
      (error) => {
        reject(error);
      },
      { onlyOnce: true }
    );
  });
}

/**
 * Получает подписку по ID (однократно)
 */
export async function getSubscriptionById(id: string): Promise<Subscription | null> {
  return new Promise((resolve, reject) => {
    const subscriptionRef = ref(database, `${SUBSCRIPTIONS_PATH}/${id}`);

    onValue(
      subscriptionRef,
      (snapshot) => {
        const data = snapshot.val();
        if (!data) {
          resolve(null);
          return;
        }

        resolve({
          id,
          ...data,
        });
      },
      (error) => {
        reject(error);
      },
      { onlyOnce: true }
    );
  });
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
  const subscriptionsRef = ref(database, SUBSCRIPTIONS_PATH);

  const unsubscribe = onValue(
    subscriptionsRef,
    (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        callback([]);
        return;
      }

      const subscriptions: Subscription[] = Object.entries(data).map(([id, value]) => ({
        id,
        ...(value as Omit<Subscription, 'id'>),
      }));

      callback(subscriptions);
    },
    (error) => {
      if (onError) {
        onError(error as Error);
      }
    }
  );

  return unsubscribe;
}

/**
 * Подписывается на изменения подписок конкретного бота
 */
export function subscribeToBotSubscriptions(
  botId: string,
  callback: (subscriptions: Subscription[]) => void,
  onError?: (error: Error) => void
): () => void {
  const subscriptionsRef = ref(database, SUBSCRIPTIONS_PATH);

  const unsubscribe = onValue(
    subscriptionsRef,
    (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        callback([]);
        return;
      }

      const subscriptions: Subscription[] = Object.entries(data)
        .filter(([_, value]) => (value as Subscription).bot_id === botId)
        .map(([id, value]) => ({
          id,
          ...(value as Omit<Subscription, 'id'>),
        }));

      callback(subscriptions);
    },
    (error) => {
      if (onError) {
        onError(error as Error);
      }
    }
  );

  return unsubscribe;
}

/**
 * Расширяет подписки вычисляемыми полями
 */
export function enrichSubscriptionsWithDetails(
  subscriptions: Subscription[],
  warningDays: number = 7,
  botsMap?: Map<string, { name: string; character?: string; status?: string; vmName?: string }>
): SubscriptionWithDetails[] {
  return subscriptions.map((sub) => {
    const statusInfo = calculateSubscriptionStatus(sub, warningDays);
    const botInfo = botsMap?.get(sub.bot_id);

    return {
      ...sub,
      ...statusInfo,
      botName: botInfo?.name,
      botCharacter: botInfo?.character,
      botStatus: botInfo?.status as any,
      botVmName: botInfo?.vmName,
    };
  });
}
