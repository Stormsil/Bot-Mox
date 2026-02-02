"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIPQSStatus = exports.checkIPQuality = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
// Initialize Firebase Admin
admin.initializeApp();
const database = admin.database();
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
exports.checkIPQuality = functions.https.onCall(async (data, context) => {
    try {
        // Проверяем авторизацию (опционально, можно убрать если нужен публичный доступ)
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Требуется аутентификация для использования этой функции');
        }
        // Получаем IP адрес из запроса
        const ip = data?.ip;
        if (!ip || typeof ip !== 'string') {
            throw new functions.https.HttpsError('invalid-argument', 'IP адрес обязателен и должен быть строкой');
        }
        // Валидация формата IP адреса
        const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/;
        if (!ipv4Regex.test(ip) && !ipv6Regex.test(ip)) {
            throw new functions.https.HttpsError('invalid-argument', 'Некорректный формат IP адреса');
        }
        // Получаем настройки API ключей из Realtime Database
        const apiKeysSnapshot = await database.ref('settings/api_keys').once('value');
        const apiKeys = apiKeysSnapshot.val();
        // Проверяем, включен ли IPQS
        if (!apiKeys?.ipqs?.enabled) {
            throw new functions.https.HttpsError('failed-precondition', 'IPQualityScore проверка отключена в настройках');
        }
        // Проверяем наличие API ключа
        if (!apiKeys.ipqs.api_key || apiKeys.ipqs.api_key.length === 0) {
            throw new functions.https.HttpsError('failed-precondition', 'API ключ IPQualityScore не настроен');
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
            throw new functions.https.HttpsError('internal', `IPQualityScore API вернул ошибку: ${response.status} ${response.statusText}`);
        }
        const result = await response.json();
        // Проверяем успешность ответа от IPQS
        if (!result.success) {
            throw new functions.https.HttpsError('internal', `IPQualityScore API ошибка: ${result.message || 'Unknown error'}`);
        }
        // Возвращаем успешный результат
        return {
            success: true,
            data: result
        };
    }
    catch (error) {
        // Логируем ошибку для отладки
        console.error('Error in checkIPQuality function:', error);
        // Если это уже HttpsError, пробрасываем дальше
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        // Обрабатываем другие типы ошибок
        if (error instanceof Error) {
            throw new functions.https.HttpsError('internal', `Внутренняя ошибка: ${error.message}`);
        }
        // Неизвестная ошибка
        throw new functions.https.HttpsError('internal', 'Произошла неизвестная ошибка при проверке IP');
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
exports.getIPQSStatus = functions.https.onCall(async (_data, context) => {
    try {
        // Проверяем авторизацию
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Требуется аутентификация');
        }
        // Получаем настройки API ключей из Realtime Database
        const apiKeysSnapshot = await database.ref('settings/api_keys').once('value');
        const apiKeys = apiKeysSnapshot.val();
        return {
            enabled: apiKeys?.ipqs?.enabled ?? false,
            configured: !!apiKeys?.ipqs?.api_key && apiKeys.ipqs.api_key.length > 0
        };
    }
    catch (error) {
        console.error('Error in getIPQSStatus function:', error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', 'Ошибка при получении статуса IPQualityScore');
    }
});
//# sourceMappingURL=index.js.map