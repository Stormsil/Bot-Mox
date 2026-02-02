import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin
admin.initializeApp();

const database = admin.database();

// IPQualityScore API Response Interface
interface IPQSResponse {
  success: boolean;
  message?: string;
  fraud_score: number;
  country_code: string;
  region: string;
  city: string;
  zip_code: string;
  isp: string;
  organization: string;
  timezone: string;
  latitude: number;
  longitude: number;
  vpn: boolean;
  proxy: boolean;
  tor: boolean;
  bot_status: boolean;
  [key: string]: unknown;
}

// API Keys Interface
interface IPQSApiKey {
  api_key: string;
  enabled: boolean;
}

interface ApiKeys {
  ipqs: IPQSApiKey;
}

// Request interface for checkIPQuality
interface CheckIPQualityRequest {
  ip: string;
}

// Callable context interface
interface CallableContext {
  auth?: {
    uid: string;
    token: admin.auth.DecodedIdToken;
  };
}

/**
 * HTTP Callable Function для проверки IP адреса через IPQualityScore API
 * Решает проблему CORS при прямых запросах из браузера
 *
 * Callable functions автоматически обрабатывают CORS preflight запросы,
 * поэтому дополнительная настройка не требуется.
 *
 * @param data - объект с полем ip (IP адрес для проверки)
 * @param context - контекст вызова функции
 * @returns Promise с результатом проверки IPQualityScore
 */
export const checkIPQuality = functions.https.onCall(async (data: CheckIPQualityRequest, context: CallableContext) => {
  try {
    // Проверяем авторизацию (опционально, можно убрать если нужен публичный доступ)
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Требуется аутентификация для использования этой функции'
      );
    }

    // Получаем IP адрес из запроса
    const ip = data?.ip;

    if (!ip || typeof ip !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'IP адрес обязателен и должен быть строкой'
      );
    }

    // Валидация формата IP адреса
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/;

    if (!ipv4Regex.test(ip) && !ipv6Regex.test(ip)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Некорректный формат IP адреса'
      );
    }

    // Получаем настройки API ключей из Realtime Database
    const apiKeysSnapshot = await database.ref('settings/api_keys').once('value');
    const apiKeys = apiKeysSnapshot.val() as ApiKeys | null;

    // Проверяем, включен ли IPQS
    if (!apiKeys?.ipqs?.enabled) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'IPQualityScore проверка отключена в настройках'
      );
    }

    // Проверяем наличие API ключа
    if (!apiKeys.ipqs.api_key || apiKeys.ipqs.api_key.length === 0) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'API ключ IPQualityScore не настроен'
      );
    }

    const apiKey = apiKeys.ipqs.api_key;

    // Формируем URL для запроса к IPQualityScore API
    const ipqsUrl = `https://www.ipqualityscore.com/api/json/ip/${encodeURIComponent(apiKey)}/${encodeURIComponent(ip)}?strictness=1&allow_public_access_points=true&fast=true`;

    // Делаем запрос к IPQualityScore API
    const response = await fetch(ipqsUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new functions.https.HttpsError(
        'internal',
        `IPQualityScore API вернул ошибку: ${response.status} ${response.statusText}`
      );
    }

    const result = await response.json() as IPQSResponse;

    // Проверяем успешность ответа от IPQS
    if (!result.success) {
      throw new functions.https.HttpsError(
        'internal',
        `IPQualityScore API ошибка: ${result.message || 'Unknown error'}`
      );
    }

    // Возвращаем успешный результат
    return {
      success: true,
      data: result
    };

  } catch (error) {
    // Логируем ошибку для отладки
    console.error('Error in checkIPQuality function:', error);

    // Если это уже HttpsError, пробрасываем дальше
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    // Обрабатываем другие типы ошибок
    if (error instanceof Error) {
      throw new functions.https.HttpsError(
        'internal',
        `Внутренняя ошибка: ${error.message}`
      );
    }

    // Неизвестная ошибка
    throw new functions.https.HttpsError(
      'internal',
      'Произошла неизвестная ошибка при проверке IP'
    );
  }
});

/**
 * HTTP Callable Function для проверки статуса IPQualityScore
 * Возвращает информацию о том, включена ли проверка и настроен ли API ключ
 *
 * Callable functions автоматически обрабатывают CORS preflight запросы.
 *
 * @param _data - данные запроса (не используются)
 * @param context - контекст вызова функции
 * @returns Promise со статусом IPQualityScore
 */
export const getIPQSStatus = functions.https.onCall(async (_data: unknown, context: CallableContext) => {
  try {
    // Проверяем авторизацию
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Требуется аутентификация'
      );
    }

    // Получаем настройки API ключей из Realtime Database
    const apiKeysSnapshot = await database.ref('settings/api_keys').once('value');
    const apiKeys = apiKeysSnapshot.val() as ApiKeys | null;

    return {
      enabled: apiKeys?.ipqs?.enabled ?? false,
      configured: !!apiKeys?.ipqs?.api_key && apiKeys.ipqs.api_key.length > 0
    };

  } catch (error) {
    console.error('Error in getIPQSStatus function:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      'Ошибка при получении статуса IPQualityScore'
    );
  }
});
