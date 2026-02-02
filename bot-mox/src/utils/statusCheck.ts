/**
 * Утилиты для проверки статусов ботов, лицензий, прокси и подписок
 */

// Проверка истечения срока
export const isExpired = (expiresAt: number): boolean => {
  return Date.now() > expiresAt;
};

// Проверка скорого истечения (по умолчанию 7 дней)
export const isExpiringSoon = (expiresAt: number, daysThreshold: number = 7): boolean => {
  const daysRemaining = Math.ceil((expiresAt - Date.now()) / (1000 * 60 * 60 * 24));
  return daysRemaining <= daysThreshold && daysRemaining > 0;
};

// Получение оставшихся дней
export const getDaysRemaining = (expiresAt: number): number => {
  return Math.ceil((expiresAt - Date.now()) / (1000 * 60 * 60 * 24));
};

// Проверка offline статуса (по умолчанию 5 минут)
export const isOffline = (lastSeen: number, timeoutMinutes: number = 5): boolean => {
  const lastSeenMinutes = Math.floor((Date.now() - lastSeen) / (1000 * 60));
  return lastSeenMinutes > timeoutMinutes;
};

// Получение минут с последнего появления
export const getLastSeenMinutes = (lastSeen: number): number => {
  return Math.floor((Date.now() - lastSeen) / (1000 * 60));
};

// Получение цвета для fraud score
export const getFraudScoreColor = (score: number): string => {
  if (score <= 20) return '#52c41a'; // Low risk - green
  if (score <= 50) return '#faad14'; // Medium risk - yellow
  return '#ff4d4f'; // High risk - red
};

// Получение статуса для fraud score
export const getFraudScoreStatus = (score: number): string => {
  if (score <= 20) return 'Low Risk';
  if (score <= 50) return 'Medium Risk';
  return 'High Risk';
};

// Получение цвета для статуса
export const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    active: '#52c41a',
    expired: '#ff4d4f',
    revoked: '#f5222d',
    banned: '#ff4d4f',
    offline: '#8c8c8c',
    prepare: '#1890ff',
    leveling: '#722ed1',
    profession: '#eb2f96',
    farming: '#52c41a',
    cancelled: '#8c8c8c',
  };
  return colors[status] || '#8c8c8c';
};

// Интерфейс для результата проверки статуса
export interface StatusCheckResult {
  isValid: boolean;
  isExpired: boolean;
  isExpiringSoon: boolean;
  daysRemaining: number;
  message: string;
  severity: 'success' | 'warning' | 'error';
}

// Проверка статуса лицензии
export const checkLicenseStatus = (expiresAt: number): StatusCheckResult => {
  const expired = isExpired(expiresAt);
  const expiringSoon = isExpiringSoon(expiresAt);
  const days = getDaysRemaining(expiresAt);

  if (expired) {
    return {
      isValid: false,
      isExpired: true,
      isExpiringSoon: false,
      daysRemaining: days,
      message: 'License has expired',
      severity: 'error',
    };
  }

  if (expiringSoon) {
    return {
      isValid: true,
      isExpired: false,
      isExpiringSoon: true,
      daysRemaining: days,
      message: `License expires in ${days} days`,
      severity: 'warning',
    };
  }

  return {
    isValid: true,
    isExpired: false,
    isExpiringSoon: false,
    daysRemaining: days,
    message: 'License is active',
    severity: 'success',
  };
};

// Проверка статуса прокси
export const checkProxyStatus = (
  expiresAt: number,
  proxyStatus?: string
): StatusCheckResult => {
  // Проверка на бан
  if (proxyStatus === 'banned') {
    return {
      isValid: false,
      isExpired: false,
      isExpiringSoon: false,
      daysRemaining: 0,
      message: 'Proxy has been banned',
      severity: 'error',
    };
  }

  const expired = isExpired(expiresAt);
  const expiringSoon = isExpiringSoon(expiresAt);
  const days = getDaysRemaining(expiresAt);

  if (expired) {
    return {
      isValid: false,
      isExpired: true,
      isExpiringSoon: false,
      daysRemaining: days,
      message: 'Proxy has expired',
      severity: 'error',
    };
  }

  if (expiringSoon) {
    return {
      isValid: true,
      isExpired: false,
      isExpiringSoon: true,
      daysRemaining: days,
      message: `Proxy expires in ${days} days`,
      severity: 'warning',
    };
  }

  return {
    isValid: true,
    isExpired: false,
    isExpiringSoon: false,
    daysRemaining: days,
    message: 'Proxy is active',
    severity: 'success',
  };
};

// Проверка статуса подписки
export const checkSubscriptionStatus = (expiresAt: number): StatusCheckResult => {
  const expired = isExpired(expiresAt);
  const expiringSoon = isExpiringSoon(expiresAt);
  const days = getDaysRemaining(expiresAt);

  if (expired) {
    return {
      isValid: false,
      isExpired: true,
      isExpiringSoon: false,
      daysRemaining: days,
      message: 'Subscription has expired',
      severity: 'error',
    };
  }

  if (expiringSoon) {
    return {
      isValid: true,
      isExpired: false,
      isExpiringSoon: true,
      daysRemaining: days,
      message: `Subscription expires in ${days} days`,
      severity: 'warning',
    };
  }

  return {
    isValid: true,
    isExpired: false,
    isExpiringSoon: false,
    daysRemaining: days,
    message: 'Subscription is active',
    severity: 'success',
  };
};

// Проверка общего здоровья бота
export interface BotHealthCheck {
  isHealthy: boolean;
  issues: string[];
  warnings: string[];
  severity: 'success' | 'warning' | 'error';
}

export const checkBotHealth = ({
  licenseExpired,
  proxyExpired,
  proxyBanned,
  subscriptionsExpired,
  isOffline,
}: {
  licenseExpired: boolean;
  proxyExpired: boolean;
  proxyBanned: boolean;
  subscriptionsExpired: number;
  isOffline: boolean;
}): BotHealthCheck => {
  const issues: string[] = [];
  const warnings: string[] = [];

  if (licenseExpired) {
    issues.push('License expired');
  }
  if (proxyExpired) {
    issues.push('Proxy expired');
  }
  if (proxyBanned) {
    issues.push('Proxy banned');
  }
  if (subscriptionsExpired > 0) {
    issues.push(`${subscriptionsExpired} subscription(s) expired`);
  }
  if (isOffline) {
    warnings.push('Bot is offline');
  }

  const severity = issues.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'success';

  return {
    isHealthy: issues.length === 0 && warnings.length === 0,
    issues,
    warnings,
    severity,
  };
};
