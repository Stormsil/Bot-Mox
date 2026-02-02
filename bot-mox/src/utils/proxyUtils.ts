import type { IPQSResponse } from '../types';

export interface ParsedProxy {
  ip: string;
  port: number;
  login: string;
  password: string;
  type: 'http' | 'socks5';
}

/**
 * Парсит прокси-строку в форматах:
 * - ip:port:login:password
 * - ip:port@login:password
 * - login:password@ip:port
 * - socks5://ip:port:login:password
 * - http://ip:port:login:password
 */
export function parseProxyString(proxyString: string): ParsedProxy | null {
  if (!proxyString || typeof proxyString !== 'string') {
    return null;
  }

  const trimmed = proxyString.trim();
  if (!trimmed) return null;

  let type: 'http' | 'socks5' = 'socks5';
  let cleanString = trimmed;

  // Определяем тип из протокола
  if (cleanString.startsWith('socks5://')) {
    type = 'socks5';
    cleanString = cleanString.replace('socks5://', '');
  } else if (cleanString.startsWith('http://')) {
    type = 'http';
    cleanString = cleanString.replace('http://', '');
  } else if (cleanString.startsWith('https://')) {
    type = 'http';
    cleanString = cleanString.replace('https://', '');
  }

  // Пробуем разные форматы
  const formats = [
    // ip:port:login:password
    /^([^:]+):(\d+):([^:]+):(.+)$/,
    // ip:port@login:password
    /^([^:]+):(\d+)@([^:]+):(.+)$/,
    // login:password@ip:port
    /^([^:]+):([^@]+)@([^:]+):(\d+)$/,
  ];

  for (const regex of formats) {
    const match = cleanString.match(regex);
    if (match) {
      const groups = match.slice(1);
      
      // Определяем, какой формат сработал
      if (regex.source.includes('@') && regex.source.includes('\\d+') && regex.source.indexOf('\\d+') > regex.source.indexOf('@')) {
        // login:password@ip:port
        return {
          login: groups[0],
          password: groups[1],
          ip: groups[2],
          port: parseInt(groups[3], 10),
          type,
        };
      } else {
        // ip:port:login:password или ip:port@login:password
        return {
          ip: groups[0],
          port: parseInt(groups[1], 10),
          login: groups[2],
          password: groups[3],
          type,
        };
      }
    }
  }

  return null;
}

/**
 * Проверяет валидность IP адреса
 */
export function isValidIP(ip: string): boolean {
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return ipv4Regex.test(ip);
}

/**
 * Проверяет валидность порта
 */
export function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port > 0 && port <= 65535;
}

/**
 * Форматирует прокси обратно в строку
 */
export function formatProxyString(proxy: ParsedProxy): string {
  return `${proxy.ip}:${proxy.port}:${proxy.login}:${proxy.password}`;
}

/**
 * Проверяет прокси через IPQS API
 * Требуется API ключ, который должен быть настроен в переменных окружения
 */
export async function checkProxyWithIPQS(
  ip: string,
  apiKey: string
): Promise<IPQSResponse | null> {
  if (!apiKey) {
    console.warn('IPQS API key not provided');
    return null;
  }

  try {
    const url = `https://ipqualityscore.com/api/json/ip/${apiKey}/${ip}?strictness=1&allow_public_access_points=true`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`IPQS API error: ${response.status}`);
    }

    const data = await response.json();
    return data as IPQSResponse;
  } catch (error) {
    console.error('Error checking proxy with IPQS:', error);
    return null;
  }
}

/**
 * Получает цвет для fraud score
 */
export function getFraudScoreColor(score: number): string {
  if (score <= 20) return '#52c41a'; // Зеленый - низкий риск
  if (score <= 50) return '#faad14'; // Желтый - средний риск
  if (score <= 75) return '#ff7a45'; // Оранжевый - высокий риск
  return '#ff4d4f'; // Красный - критический риск
}

/**
 * Получает текстовое описание fraud score
 */
export function getFraudScoreLabel(score: number): string {
  if (score <= 20) return 'Low Risk';
  if (score <= 50) return 'Medium Risk';
  if (score <= 75) return 'High Risk';
  return 'Critical Risk';
}

/**
 * Получает флаг страны по коду
 */
export function getCountryFlag(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return '🏳️';
  
  // Конвертируем код страны в эмодзи флага
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  
  return String.fromCodePoint(...codePoints);
}

/**
 * Определяет провайдера по IP (упрощенная версия)
 * В реальном приложении можно использовать базу данных ASN
 */
export function detectProvider(ip: string): string {
  // Это упрощенная заглушка
  // В реальном приложении здесь должен быть запрос к базе данных ASN
  // или к API для определения провайдера
  return 'Unknown';
}
