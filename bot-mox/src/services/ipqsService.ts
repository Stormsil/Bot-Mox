import type { IPQSResponse, Proxy } from '../types';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApiKeys, getProxySettings } from './apiKeysService';
import app from '../utils/firebase';

/**
 * Сервис для работы с IPQualityScore API
 * Поддерживает два режима работы:
 * 1. Локальный прокси-сервер (для разработки) - http://localhost:3001
 * 2. Firebase Cloud Functions (для production)
 *
 * Проверка прокси на fraud score, VPN, TOR и другие параметры
 */

// Инициализируем Functions
const functions = getFunctions(app);

// Создаем callable функции
const checkIPQualityCallable = httpsCallable<{ ip: string }, { success: boolean; data: IPQSResponse }>(
  functions,
  'checkIPQuality'
);

const getIPQSStatusCallable = httpsCallable<Record<string, never>, { enabled: boolean; configured: boolean }>(
  functions,
  'getIPQSStatus'
);

// Конфигурация локального прокси-сервера
const LOCAL_PROXY_URL = 'http://localhost:3001';

/**
 * Проверяет доступность локального прокси-сервера
 * @returns Promise<boolean>
 */
async function isLocalProxyAvailable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout

    const response = await fetch(`${LOCAL_PROXY_URL}/api/status`, {
      method: 'GET',
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Проверяет IP адрес через локальный прокси-сервер
 * @param ip - IP адрес для проверки
 * @returns Promise<IPQSResponse | null>
 */
async function checkIPQualityViaLocalProxy(ip: string): Promise<IPQSResponse | null> {
  try {
    const response = await fetch(`${LOCAL_PROXY_URL}/api/check-ip`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ip })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.warn('Local proxy returned error:', errorData.error || response.statusText);
      return null;
    }

    const result = await response.json();

    if (result.success && result.data) {
      return result.data as IPQSResponse;
    }

    return null;
  } catch (error) {
    console.error('Error checking IP via local proxy:', error);
    return null;
  }
}

/**
 * Проверяет IP адрес через IPQualityScore API
 * Сначала пробует локальный прокси-сервер, затем Cloud Function, затем прямой запрос
 * @param ip - IP адрес для проверки
 * @returns Promise<IPQSResponse | null> - результат проверки или null в случае ошибки
 */
export async function checkIPQuality(ip: string): Promise<IPQSResponse | null> {
  // Сначала пробуем локальный прокси-сервер (для разработки)
  const isLocalAvailable = await isLocalProxyAvailable();

  if (isLocalAvailable) {
    console.log('🔄 Using local proxy server for IP check');
    const result = await checkIPQualityViaLocalProxy(ip);
    if (result) {
      return result;
    }
    console.warn('Local proxy failed, trying direct API call...');
  } else {
    console.warn('Local proxy not available, trying direct API call...');
  }

  // Прямой запрос к IPQS API (fallback)
  return checkIPQualityDirect(ip);
}

/**
 * Прямой запрос к IPQualityScore API (fallback для разработки)
 * @param ip - IP адрес для проверки
 * @returns Promise<IPQSResponse | null> - результат проверки или null в случае ошибки
 */
async function checkIPQualityDirect(ip: string): Promise<IPQSResponse | null> {
  try {
    // Получаем API ключ из настроек
    const apiKeys = await getApiKeys();

    // Проверяем, включена ли проверка IPQS
    if (!apiKeys.ipqs.enabled || !apiKeys.ipqs.api_key) {
      console.warn('IPQS check is disabled or API key not configured');
      return null;
    }

    const apiKey = apiKeys.ipqs.api_key;
    const IPQS_API_BASE = 'https://www.ipqualityscore.com/api/json/ip';

    // Формируем URL с параметрами
    const url = `${IPQS_API_BASE}/${apiKey}/${ip}?strictness=1&allow_public_access_points=true&fast=true`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`IPQS API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.success) {
      console.warn('IPQS API returned error:', data.message);
      return null;
    }

    return data as IPQSResponse;
  } catch (error) {
    console.error('Error in direct IP quality check:', error);
    return null;
  }
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
    const [apiKeys, proxySettings] = await Promise.all([
      getApiKeys(),
      getProxySettings()
    ]);

    // Автопроверка включена только если:
    // 1. IPQS включен и есть API ключ
    // 2. В настройках прокси включена автопроверка при добавлении
    return (
      apiKeys.ipqs.enabled &&
      apiKeys.ipqs.api_key.length > 0 &&
      proxySettings.auto_check_on_add
    );
  } catch (error) {
    console.error('Error checking auto check status:', error);
    return false;
  }
}

/**
 * Получает статус IPQS через локальный прокси или Cloud Function
 * @returns Promise<boolean> - true если проверка включена
 */
export async function isIPQSCheckEnabled(): Promise<boolean> {
  // Сначала пробуем локальный прокси
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(`${LOCAL_PROXY_URL}/api/status`, {
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      return data.ipqs?.enabled && data.ipqs?.configured;
    }
  } catch {
    // Локальный прокси недоступен, используем прямое чтение из базы
  }

  // Прямое чтение из Firebase
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
  const localProxyAvailable = await isLocalProxyAvailable();

  if (localProxyAvailable) {
    try {
      const response = await fetch(`${LOCAL_PROXY_URL}/api/status`);
      if (response.ok) {
        const data = await response.json();
        return {
          enabled: data.ipqs?.enabled || false,
          configured: data.ipqs?.configured || false,
          localProxyAvailable: true
        };
      }
    } catch {
      // Игнорируем ошибки
    }
  }

  // Прямое чтение из Firebase
  try {
    const apiKeys = await getApiKeys();
    return {
      enabled: apiKeys.ipqs.enabled,
      configured: apiKeys.ipqs.api_key.length > 0,
      localProxyAvailable: false
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

  // Удаляем undefined поля чтобы избежать ошибок Firebase
  Object.keys(updates).forEach(key => {
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
    // Проверяем доступность локального прокси
    const localProxyUsed = await isLocalProxyAvailable();

    // Проверяем, включена ли проверка IPQS
    const isEnabled = await isIPQSCheckEnabled();
    if (!isEnabled) {
      return {
        data: null,
        isSuspicious: false,
        error: 'IPQS check is disabled or API key not configured',
        localProxyUsed
      };
    }

    const data = await checkIPQuality(ip);

    if (!data) {
      return {
        data: null,
        isSuspicious: false,
        error: 'Failed to check IP quality',
        localProxyUsed
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
      localProxyUsed: false
    };
  }
}

/**
 * Проверяет доступность локального прокси-сервера и возвращает статус
 * @returns Promise<{ available: boolean; message: string }>
 */
export async function checkLocalProxyStatus(): Promise<{ available: boolean; message: string }> {
  const available = await isLocalProxyAvailable();

  if (available) {
    return {
      available: true,
      message: 'Local proxy server is running on http://localhost:3001'
    };
  }

  return {
    available: false,
    message: 'Local proxy server is not available. Please start it with: cd proxy-server && npm start'
  };
}
