import { uiLogger } from '../observability/uiLogger';
import type { SubscriptionSettings } from '../types';
import { apiGet, apiPut } from './apiClient';

const SETTINGS_PATH = '/api/v1/settings/alerts';

/**
 * Глобальные пороги предупреждений по ресурсам
 */
export function getDefaultSettings(): SubscriptionSettings {
  return {
    warning_days: 7,
    updated_at: Date.now(),
  };
}

function normalizeSubscriptionSettings(raw: unknown): SubscriptionSettings {
  if (!raw || typeof raw !== 'object') {
    return getDefaultSettings();
  }

  const source = raw as Record<string, unknown>;

  return {
    warning_days:
      typeof source.warning_days === 'number' && Number.isFinite(source.warning_days)
        ? source.warning_days
        : getDefaultSettings().warning_days,
    updated_at:
      typeof source.updated_at === 'number' && Number.isFinite(source.updated_at)
        ? source.updated_at
        : Date.now(),
    updated_by: typeof source.updated_by === 'string' ? source.updated_by : undefined,
  };
}

/**
 * Получает глобальные пороги предупреждений из backend API
 */
export async function getSubscriptionSettings(): Promise<SubscriptionSettings> {
  try {
    const response = await apiGet<unknown>(SETTINGS_PATH);
    return normalizeSubscriptionSettings(response.data);
  } catch (error) {
    uiLogger.error('Error loading subscription settings:', error);
    return getDefaultSettings();
  }
}

/**
 * Обновляет глобальные пороги предупреждений
 */
export async function updateSubscriptionSettings(
  settings: Partial<SubscriptionSettings>,
  userId?: string,
): Promise<void> {
  const updates: SubscriptionSettings = {
    ...getDefaultSettings(),
    ...settings,
    updated_at: Date.now(),
  };

  if (userId) {
    updates.updated_by = userId;
  }

  await apiPut(SETTINGS_PATH, updates);
}

/**
 * Инициализирует глобальные пороги предупреждений, если они не существуют
 */
export async function initSubscriptionSettings(): Promise<void> {
  try {
    const current = await getSubscriptionSettings();
    if (!current || typeof current.warning_days !== 'number') {
      await updateSubscriptionSettings(getDefaultSettings());
    }
  } catch (error) {
    uiLogger.error('Error initializing subscription settings:', error);
  }
}
