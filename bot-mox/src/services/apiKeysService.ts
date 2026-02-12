import { apiGet, apiPut } from './apiClient';
import type { ApiKeys, ProxySettings, NotificationEvents } from '../types';

const SETTINGS_API_PREFIX = '/api/v1/settings';

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const normalizeApiKeys = (value: unknown): ApiKeys => {
  const source = asRecord(value);
  const ipqs = asRecord(source.ipqs);
  const telegram = asRecord(source.telegram);

  return {
    ipqs: {
      api_key: typeof ipqs.api_key === 'string' ? ipqs.api_key : '',
      enabled: Boolean(ipqs.enabled),
    },
    telegram: {
      bot_token: typeof telegram.bot_token === 'string' ? telegram.bot_token : '',
      chat_id: typeof telegram.chat_id === 'string' ? telegram.chat_id : '',
      enabled: Boolean(telegram.enabled),
    },
  };
};

const normalizeProxySettings = (value: unknown): ProxySettings => {
  const source = asRecord(value);
  return {
    auto_check_on_add:
      typeof source.auto_check_on_add === 'boolean' ? source.auto_check_on_add : true,
    fraud_score_threshold:
      typeof source.fraud_score_threshold === 'number' ? source.fraud_score_threshold : 75,
    check_interval_hours:
      typeof source.check_interval_hours === 'number' ? source.check_interval_hours : 0,
  };
};

const normalizeNotificationEvents = (value: unknown): NotificationEvents => {
  const source = asRecord(value);
  return {
    bot_banned: typeof source.bot_banned === 'boolean' ? source.bot_banned : true,
    bot_offline: typeof source.bot_offline === 'boolean' ? source.bot_offline : true,
    bot_online: typeof source.bot_online === 'boolean' ? source.bot_online : false,
    level_up: typeof source.level_up === 'boolean' ? source.level_up : true,
    profession_maxed: typeof source.profession_maxed === 'boolean' ? source.profession_maxed : false,
    low_fraud_score: typeof source.low_fraud_score === 'boolean' ? source.low_fraud_score : true,
    daily_report: typeof source.daily_report === 'boolean' ? source.daily_report : false,
  };
};

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
    const response = await apiGet<unknown>(`${SETTINGS_API_PREFIX}/api_keys`);
    return normalizeApiKeys(response.data);
  } catch (error) {
    console.error('Error loading API keys:', error);
    return getDefaultApiKeys();
  }
}

/**
 * Обновляет API ключи
 */
export async function updateApiKeys(apiKeys: Partial<ApiKeys>): Promise<void> {
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

  await apiPut(`${SETTINGS_API_PREFIX}/api_keys`, updates);
}

/**
 * Получает настройки прокси
 */
export async function getProxySettings(): Promise<ProxySettings> {
  try {
    const response = await apiGet<unknown>(`${SETTINGS_API_PREFIX}/proxy`);
    return normalizeProxySettings(response.data);
  } catch (error) {
    console.error('Error loading proxy settings:', error);
    return getDefaultProxySettings();
  }
}

/**
 * Обновляет настройки прокси
 */
export async function updateProxySettings(settings: Partial<ProxySettings>): Promise<void> {
  const currentSettings = await getProxySettings();

  const updates: ProxySettings = {
    ...currentSettings,
    ...settings,
  };

  await apiPut(`${SETTINGS_API_PREFIX}/proxy`, updates);
}

/**
 * Получает настройки событий уведомлений
 */
export async function getNotificationEvents(): Promise<NotificationEvents> {
  try {
    const response = await apiGet<unknown>(`${SETTINGS_API_PREFIX}/notifications/events`);
    return normalizeNotificationEvents(response.data);
  } catch (error) {
    console.error('Error loading notification events:', error);
    return getDefaultNotificationEvents();
  }
}

/**
 * Обновляет настройки событий уведомлений
 */
export async function updateNotificationEvents(events: Partial<NotificationEvents>): Promise<void> {
  const currentEvents = await getNotificationEvents();

  const updates: NotificationEvents = {
    ...currentEvents,
    ...events,
  };

  await apiPut(`${SETTINGS_API_PREFIX}/notifications/events`, updates);
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
    const [apiKeys, proxySettings, notificationEvents] = await Promise.all([
      getApiKeys(),
      getProxySettings(),
      getNotificationEvents(),
    ]);

    if (!apiKeys.ipqs || !apiKeys.telegram) {
      await apiPut(`${SETTINGS_API_PREFIX}/api_keys`, getDefaultApiKeys());
    }

    if (
      typeof proxySettings.auto_check_on_add !== 'boolean'
      || typeof proxySettings.fraud_score_threshold !== 'number'
    ) {
      await apiPut(`${SETTINGS_API_PREFIX}/proxy`, getDefaultProxySettings());
    }

    if (
      typeof notificationEvents.bot_banned !== 'boolean'
      || typeof notificationEvents.bot_offline !== 'boolean'
    ) {
      await apiPut(`${SETTINGS_API_PREFIX}/notifications/events`, getDefaultNotificationEvents());
    }
  } catch (error) {
    console.error('Error initializing API settings:', error);
  }
}
