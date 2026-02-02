import { ref, get, set, update } from 'firebase/database';
import { database } from '../utils/firebase';
import type { ApiKeys, ProxySettings, NotificationEvents } from '../types';

const API_KEYS_PATH = 'settings/api_keys';
const PROXY_SETTINGS_PATH = 'settings/proxy';
const NOTIFICATION_EVENTS_PATH = 'settings/notifications/events';

/**
 * API ключи по умолчанию
 */
export function getDefaultApiKeys(): ApiKeys {
  return {
    ipqs: {
      api_key: '',
      enabled: false,
    },
    telegram: {
      bot_token: '',
      chat_id: '',
      enabled: false,
    },
  };
}

/**
 * Настройки прокси по умолчанию
 */
export function getDefaultProxySettings(): ProxySettings {
  return {
    auto_check_on_add: true,
    fraud_score_threshold: 75,
    check_interval_hours: 0,
  };
}

/**
 * События уведомлений по умолчанию
 */
export function getDefaultNotificationEvents(): NotificationEvents {
  return {
    bot_banned: true,
    bot_offline: true,
    bot_online: false,
    level_up: true,
    profession_maxed: false,
    low_fraud_score: true,
    daily_report: false,
  };
}

/**
 * Получает API ключи из Firebase
 */
export async function getApiKeys(): Promise<ApiKeys> {
  try {
    const apiKeysRef = ref(database, API_KEYS_PATH);
    const snapshot = await get(apiKeysRef);

    if (snapshot.exists()) {
      return snapshot.val() as ApiKeys;
    }

    return getDefaultApiKeys();
  } catch (error) {
    console.error('Error loading API keys:', error);
    return getDefaultApiKeys();
  }
}

/**
 * Обновляет API ключи
 */
export async function updateApiKeys(apiKeys: Partial<ApiKeys>): Promise<void> {
  const apiKeysRef = ref(database, API_KEYS_PATH);

  const currentKeys = await getApiKeys();

  const updates: ApiKeys = {
    ipqs: {
      ...currentKeys.ipqs,
      ...apiKeys.ipqs,
    },
    telegram: {
      ...currentKeys.telegram,
      ...apiKeys.telegram,
    },
  };

  await set(apiKeysRef, updates);
}

/**
 * Получает настройки прокси
 */
export async function getProxySettings(): Promise<ProxySettings> {
  try {
    const settingsRef = ref(database, PROXY_SETTINGS_PATH);
    const snapshot = await get(settingsRef);

    if (snapshot.exists()) {
      return snapshot.val() as ProxySettings;
    }

    return getDefaultProxySettings();
  } catch (error) {
    console.error('Error loading proxy settings:', error);
    return getDefaultProxySettings();
  }
}

/**
 * Обновляет настройки прокси
 */
export async function updateProxySettings(settings: Partial<ProxySettings>): Promise<void> {
  const settingsRef = ref(database, PROXY_SETTINGS_PATH);

  const currentSettings = await getProxySettings();

  const updates: ProxySettings = {
    ...currentSettings,
    ...settings,
  };

  await set(settingsRef, updates);
}

/**
 * Получает настройки событий уведомлений
 */
export async function getNotificationEvents(): Promise<NotificationEvents> {
  try {
    const eventsRef = ref(database, NOTIFICATION_EVENTS_PATH);
    const snapshot = await get(eventsRef);

    if (snapshot.exists()) {
      return snapshot.val() as NotificationEvents;
    }

    return getDefaultNotificationEvents();
  } catch (error) {
    console.error('Error loading notification events:', error);
    return getDefaultNotificationEvents();
  }
}

/**
 * Обновляет настройки событий уведомлений
 */
export async function updateNotificationEvents(events: Partial<NotificationEvents>): Promise<void> {
  const eventsRef = ref(database, NOTIFICATION_EVENTS_PATH);

  const currentEvents = await getNotificationEvents();

  const updates: NotificationEvents = {
    ...currentEvents,
    ...events,
  };

  await set(eventsRef, updates);
}

/**
 * Проверяет, включена ли проверка IPQS
 */
export async function isIPQSEnabled(): Promise<boolean> {
  const apiKeys = await getApiKeys();
  return apiKeys.ipqs.enabled && apiKeys.ipqs.api_key.length > 0;
}

/**
 * Получает API ключ IPQS
 */
export async function getIPQSApiKey(): Promise<string | null> {
  const apiKeys = await getApiKeys();
  if (apiKeys.ipqs.enabled) {
    return apiKeys.ipqs.api_key;
  }
  return null;
}

/**
 * Проверяет, включены ли уведомления Telegram
 */
export async function isTelegramEnabled(): Promise<boolean> {
  const apiKeys = await getApiKeys();
  return apiKeys.telegram.enabled && 
         apiKeys.telegram.bot_token.length > 0 && 
         apiKeys.telegram.chat_id.length > 0;
}

/**
 * Получает настройки Telegram
 */
export async function getTelegramConfig(): Promise<{ bot_token: string; chat_id: string } | null> {
  const apiKeys = await getApiKeys();
  if (apiKeys.telegram.enabled) {
    return {
      bot_token: apiKeys.telegram.bot_token,
      chat_id: apiKeys.telegram.chat_id,
    };
  }
  return null;
}

/**
 * Инициализирует все настройки API, если они не существуют
 */
export async function initApiSettings(): Promise<void> {
  try {
    // Инициализация API ключей
    const apiKeysRef = ref(database, API_KEYS_PATH);
    const apiKeysSnapshot = await get(apiKeysRef);
    if (!apiKeysSnapshot.exists()) {
      await set(apiKeysRef, getDefaultApiKeys());
    }

    // Инициализация настроек прокси
    const proxySettingsRef = ref(database, PROXY_SETTINGS_PATH);
    const proxySnapshot = await get(proxySettingsRef);
    if (!proxySnapshot.exists()) {
      await set(proxySettingsRef, getDefaultProxySettings());
    }

    // Инициализация событий уведомлений
    const eventsRef = ref(database, NOTIFICATION_EVENTS_PATH);
    const eventsSnapshot = await get(eventsRef);
    if (!eventsSnapshot.exists()) {
      await set(eventsRef, getDefaultNotificationEvents());
    }
  } catch (error) {
    console.error('Error initializing API settings:', error);
  }
}
