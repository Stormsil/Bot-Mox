import type { IPQSResponse, Proxy } from '../types';
import { API_BASE_URL as API_BASE_URL_FROM_ENV } from '../config/env';
import { getApiKeys, getProxySettings } from './apiKeysService';
import { apiGet, apiPost, ApiClientError } from './apiClient';

const LOCAL_PROXY_URL = API_BASE_URL_FROM_ENV;
const IPQS_API_PREFIX = '/api/v1/ipqs';

interface BackendStatusPayload {
  enabled?: unknown;
  configured?: unknown;
  supabaseSettingsConnected?: unknown;
}

interface BackendStatus {
  enabled: boolean;
  configured: boolean;
  supabaseSettingsConnected: boolean;
}

function normalizeBackendStatus(payload: BackendStatusPayload): BackendStatus {
  return {
    enabled: Boolean(payload.enabled),
    configured: Boolean(payload.configured),
    supabaseSettingsConnected: Boolean(payload.supabaseSettingsConnected),
  };
}

function toErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return `${error.code}: ${error.message}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

async function getStatusFromBackend(): Promise<BackendStatus | null> {
  try {
    const response = await apiGet<BackendStatusPayload>(`${IPQS_API_PREFIX}/status`);
    return normalizeBackendStatus(response.data || {});
  } catch (error) {
    console.warn('Failed to fetch IPQS status from backend:', toErrorMessage(error));
    return null;
  }
}

/**
 * Проверяет доступность backend IPQS API
 * @returns Promise<boolean>
 */
async function isLocalProxyAvailable(): Promise<boolean> {
  const status = await getStatusFromBackend();
  return Boolean(status);
}

/**
 * Проверяет IP адрес через backend API
 * @param ip - IP адрес для проверки
 * @returns Promise<IPQSResponse | null>
 */
async function checkIPQualityViaBackend(ip: string): Promise<IPQSResponse | null> {
  const normalizedIp = String(ip || '').trim();
  if (!normalizedIp) {
    return null;
  }

  try {
    const response = await apiPost<IPQSResponse>(`${IPQS_API_PREFIX}/check`, {
      ip: normalizedIp,
    });
    return response.data;
  } catch (error) {
    console.warn('IPQS backend check failed:', toErrorMessage(error));
    return null;
  }
}

/**
 * Проверяет IP адрес через backend API
 * @param ip - IP адрес для проверки
 * @returns Promise<IPQSResponse | null> - результат проверки или null в случае ошибки
 */
export async function checkIPQuality(ip: string): Promise<IPQSResponse | null> {
  const isBackendAvailable = await isLocalProxyAvailable();
  if (!isBackendAvailable) {
    console.warn('IPQS backend is unavailable');
    return null;
  }

  return checkIPQualityViaBackend(ip);
}

/**
 * Проверяет, должен ли прокси быть помечен как подозрительный
 * на основе fraud score и настроек threshold
 * @param fraudScore - fraud score от IPQS
 * @returns Promise<boolean> - true если прокси подозрительный
 */
export async function isProxySuspicious(fraudScore: number): Promise<boolean> {
  try {
    const proxySettings = await getProxySettings();
    return fraudScore > proxySettings.fraud_score_threshold;
  } catch (error) {
    console.error('Error checking proxy suspicion:', error);
    // По умолчанию считаем подозрительным если score > 75
    return fraudScore > 75;
  }
}

/**
 * Проверяет, включена ли автопроверка при добавлении прокси
 * @returns Promise<boolean> - true если автопроверка включена
 */
export async function isAutoCheckEnabled(): Promise<boolean> {
  try {
    const [apiKeys, proxySettings] = await Promise.all([getApiKeys(), getProxySettings()]);

    // Автопроверка включена только если:
    // 1. IPQS включен и есть API ключ
    // 2. В настройках прокси включена автопроверка при добавлении
    return apiKeys.ipqs.enabled && apiKeys.ipqs.api_key.length > 0 && proxySettings.auto_check_on_add;
  } catch (error) {
    console.error('Error checking auto check status:', error);
    return false;
  }
}

/**
 * Получает статус IPQS через backend API
 * @returns Promise<boolean> - true если проверка включена
 */
export async function isIPQSCheckEnabled(): Promise<boolean> {
  const status = await getStatusFromBackend();
  if (status) {
    return status.enabled && status.configured;
  }

  // Fallback через settings endpoint
  try {
    const apiKeys = await getApiKeys();
    return apiKeys.ipqs.enabled && apiKeys.ipqs.api_key.length > 0;
  } catch (error) {
    console.error('Error checking IPQS status:', error);
    return false;
  }
}

/**
 * Получает статус IPQS
 * @returns Promise<{ enabled: boolean; configured: boolean; localProxyAvailable: boolean }>
 */
export async function getIPQSStatus(): Promise<{ enabled: boolean; configured: boolean; localProxyAvailable: boolean }> {
  const status = await getStatusFromBackend();
  if (status) {
    return {
      enabled: status.enabled,
      configured: status.configured,
      localProxyAvailable: true,
    };
  }

  // Fallback через settings endpoint
  try {
    const apiKeys = await getApiKeys();
    return {
      enabled: apiKeys.ipqs.enabled,
      configured: apiKeys.ipqs.api_key.length > 0,
      localProxyAvailable: false,
    };
  } catch (error) {
    console.error('Error getting IPQS status:', error);
    return { enabled: false, configured: false, localProxyAvailable: false };
  }
}

/**
 * Получает fraud score threshold из настроек
 * @returns Promise<number> - значение threshold (по умолчанию 75)
 */
export async function getFraudScoreThreshold(): Promise<number> {
  try {
    const proxySettings = await getProxySettings();
    return proxySettings.fraud_score_threshold;
  } catch (error) {
    console.error('Error getting fraud score threshold:', error);
    return 75;
  }
}

/**
 * Обновляет данные прокси результатами проверки IPQS
 * @param proxy - текущие данные прокси
 * @param ipqsData - данные от IPQS
 * @returns Partial<Proxy> - объект с обновленными полями
 */
export function updateProxyWithIPQSData(
  proxy: Partial<Proxy>,
  ipqsData: IPQSResponse
): Partial<Proxy> {
  const updates: Partial<Proxy> = {
    ...proxy,
    fraud_score: ipqsData.fraud_score,
    country: ipqsData.country_code || proxy.country || 'Unknown',
    country_code: ipqsData.country_code || '',
    city: ipqsData.city || '',
    region: ipqsData.region || '',
    zip_code: ipqsData.zip_code || '',
    isp: ipqsData.isp || '',
    organization: ipqsData.organization || '',
    timezone: ipqsData.timezone || '',
    latitude: ipqsData.latitude ?? 0,
    longitude: ipqsData.longitude ?? 0,
    vpn: ipqsData.vpn || false,
    proxy: ipqsData.proxy || false,
    tor: ipqsData.tor || false,
    bot_status: ipqsData.bot_status || false,
    last_checked: Date.now(),
    updated_at: Date.now(),
  };

  // Удаляем undefined поля перед отправкой на backend
  Object.keys(updates).forEach((key) => {
    if (updates[key as keyof Proxy] === undefined) {
      delete updates[key as keyof Proxy];
    }
  });

  return updates;
}

/**
 * Форматирует fraud score для отображения
 * @param score - fraud score
 * @returns string - отформатированный текст
 */
export function formatFraudScore(score: number): string {
  if (score <= 20) return `${score} (Low Risk)`;
  if (score <= 50) return `${score} (Medium Risk)`;
  if (score <= 75) return `${score} (High Risk)`;
  return `${score} (Critical Risk)`;
}

/**
 * Получает цвет для fraud score
 * @param score - fraud score
 * @returns string - цвет в hex формате
 */
export function getFraudScoreColor(score: number): string {
  if (score <= 20) return '#52c41a'; // Зеленый - низкий риск
  if (score <= 50) return '#faad14'; // Желтый - средний риск
  if (score <= 75) return '#ff7a45'; // Оранжевый - высокий риск
  return '#ff4d4f'; // Красный - критический риск
}

/**
 * Получает текстовое описание fraud score
 * @param score - fraud score
 * @returns string - текстовое описание
 */
export function getFraudScoreLabel(score: number): string {
  if (score <= 20) return 'Low Risk';
  if (score <= 50) return 'Medium Risk';
  if (score <= 75) return 'High Risk';
  return 'Critical Risk';
}

/**
 * Проверяет прокси и возвращает полный результат с проверкой на подозрительность
 * @param ip - IP адрес для проверки
 * @returns Promise<{ data: IPQSResponse | null; isSuspicious: boolean; error?: string; localProxyUsed: boolean }>
 */
export async function checkProxyWithValidation(
  ip: string
): Promise<{
  data: IPQSResponse | null;
  isSuspicious: boolean;
  error?: string;
  localProxyUsed: boolean;
}> {
  try {
    // Проверяем доступность backend
    const localProxyUsed = await isLocalProxyAvailable();

    // Проверяем, включена ли проверка IPQS
    const isEnabled = await isIPQSCheckEnabled();
    if (!isEnabled) {
      return {
        data: null,
        isSuspicious: false,
        error: 'IPQS check is disabled or API key not configured',
        localProxyUsed,
      };
    }

    const data = await checkIPQuality(ip);

    if (!data) {
      return {
        data: null,
        isSuspicious: false,
        error: 'Failed to check IP quality',
        localProxyUsed,
      };
    }

    const isSuspicious = await isProxySuspicious(data.fraud_score);

    return { data, isSuspicious, localProxyUsed };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      data: null,
      isSuspicious: false,
      error: errorMessage,
      localProxyUsed: false,
    };
  }
}

/**
 * Проверяет доступность backend API и возвращает статус
 * @returns Promise<{ available: boolean; message: string }>
 */
export async function checkLocalProxyStatus(): Promise<{ available: boolean; message: string }> {
  const available = await isLocalProxyAvailable();

  if (available) {
    return {
      available: true,
      message: `Backend API is available on ${LOCAL_PROXY_URL}`,
    };
  }

  return {
    available: false,
    message: 'Backend API is unavailable. Please start proxy-server: cd proxy-server && npm start',
  };
}
