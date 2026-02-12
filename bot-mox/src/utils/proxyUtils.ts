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
