import { ref, get, set, update } from 'firebase/database';
import { database } from '../utils/firebase';
import type { SubscriptionSettings } from '../types';

const SETTINGS_PATH = 'app_settings/subscriptions';

/**
 * Настройки по умолчанию
 */
export function getDefaultSettings(): SubscriptionSettings {
  return {
    warning_days: 7,
    updated_at: Date.now(),
  };
}

/**
 * Получает настройки подписок из Firebase
 */
export async function getSubscriptionSettings(): Promise<SubscriptionSettings> {
  try {
    const settingsRef = ref(database, SETTINGS_PATH);
    const snapshot = await get(settingsRef);

    if (snapshot.exists()) {
      return snapshot.val() as SubscriptionSettings;
    }

    // Если настроек нет, возвращаем дефолтные
    return getDefaultSettings();
  } catch (error) {
    console.error('Error loading subscription settings:', error);
    return getDefaultSettings();
  }
}

/**
 * Обновляет настройки подписок
 */
export async function updateSubscriptionSettings(
  settings: Partial<SubscriptionSettings>,
  userId?: string
): Promise<void> {
  const settingsRef = ref(database, SETTINGS_PATH);

  const updates: SubscriptionSettings = {
    ...getDefaultSettings(),
    ...settings,
    updated_at: Date.now(),
  };

  if (userId) {
    updates.updated_by = userId;
  }

  await set(settingsRef, updates);
}

/**
 * Инициализирует настройки подписок, если они не существуют
 */
export async function initSubscriptionSettings(): Promise<void> {
  try {
    const settingsRef = ref(database, SETTINGS_PATH);
    const snapshot = await get(settingsRef);

    if (!snapshot.exists()) {
      await set(settingsRef, getDefaultSettings());
    }
  } catch (error) {
    console.error('Error initializing subscription settings:', error);
  }
}
