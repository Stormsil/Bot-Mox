import type { BotLicense, BotStatus, Subscription } from '../../types';
import { OFFLINE_THRESHOLD_MS, STATUS_FILTER_VALUES, type BotRecord, type ProxyLike, type StatusFilter } from './types';

export const formatProjectTitle = (projectId: string) =>
  projectId
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export const computeBotStatus = (bot: BotRecord): BotStatus => {
  if (bot.status === 'banned') return 'banned';
  const lastSeen = bot.last_seen;
  if (typeof lastSeen === 'number' && lastSeen > 0 && Date.now() - lastSeen > OFFLINE_THRESHOLD_MS) {
    return 'offline';
  }
  return bot.status || 'offline';
};

export const computeProxyStatus = (proxy?: ProxyLike) => {
  if (!proxy) {
    return {
      status: 'none' as const,
      label: 'None',
      color: 'default',
      sort: 5,
      daysRemaining: undefined as number | undefined,
    };
  }

  const isExpired = proxy.expires_at ? Date.now() > proxy.expires_at : false;
  const daysRemaining = proxy.expires_at
    ? Math.ceil((proxy.expires_at - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;
  const isExpiring = daysRemaining <= 7 && daysRemaining > 0;

  if (proxy.status === 'banned') {
    return {
      status: 'banned' as const,
      label: 'Banned',
      color: 'error',
      sort: 1,
      daysRemaining: 0,
    };
  }

  if (isExpired || proxy.status === 'expired') {
    return {
      status: 'expired' as const,
      label: 'Expired',
      color: 'error',
      sort: 2,
      daysRemaining: 0,
    };
  }

  if (isExpiring) {
    return {
      status: 'expiring' as const,
      label: 'Expiring',
      color: 'warning',
      sort: 3,
      daysRemaining,
    };
  }

  return {
    status: 'active' as const,
    label: 'Active',
    color: 'success',
    sort: 4,
    daysRemaining,
  };
};

export const computeSubscriptionStatus = (subs: Subscription[], warningDays: number) => {
  if (!subs.length) {
    return {
      status: 'none' as const,
      label: 'None',
      color: 'default',
      sort: 5,
      daysRemaining: undefined as number | undefined,
    };
  }

  const now = Date.now();
  let expiredCount = 0;
  let expiringCount = 0;
  let minDaysRemaining = Number.POSITIVE_INFINITY;

  subs.forEach((sub) => {
    const daysRemaining = Math.ceil((sub.expires_at - now) / (1000 * 60 * 60 * 24));
    minDaysRemaining = Math.min(minDaysRemaining, Math.max(0, daysRemaining));
    if (now > sub.expires_at) {
      expiredCount += 1;
    } else if (daysRemaining <= warningDays && daysRemaining > 0) {
      expiringCount += 1;
    }
  });

  if (expiredCount > 0) {
    return {
      status: 'expired' as const,
      label: 'Expired',
      color: 'error',
      sort: 1,
      daysRemaining: 0,
    };
  }

  if (expiringCount > 0) {
    return {
      status: 'expiring' as const,
      label: 'Expiring',
      color: 'warning',
      sort: 2,
      daysRemaining: Number.isFinite(minDaysRemaining) ? minDaysRemaining : undefined,
    };
  }

  return {
    status: 'active' as const,
    label: 'Active',
    color: 'success',
    sort: 3,
    daysRemaining: Number.isFinite(minDaysRemaining) ? minDaysRemaining : undefined,
  };
};

export const computeLicenseStatus = (licenses: BotLicense[], warningDays: number) => {
  if (!licenses.length) {
    return {
      status: 'none' as const,
      label: 'None',
      color: 'default',
      sort: 5,
      daysRemaining: undefined as number | undefined,
    };
  }

  const now = Date.now();
  let hasExpired = false;
  let hasExpiring = false;
  let minDaysRemaining = Number.POSITIVE_INFINITY;

  licenses.forEach((license) => {
    const daysRemaining = Math.ceil((license.expires_at - now) / (1000 * 60 * 60 * 24));
    minDaysRemaining = Math.min(minDaysRemaining, Math.max(0, daysRemaining));
    if (now > license.expires_at) {
      hasExpired = true;
    } else if (daysRemaining <= warningDays && daysRemaining > 0) {
      hasExpiring = true;
    }
  });

  if (hasExpired) {
    return {
      status: 'expired' as const,
      label: 'Expired',
      color: 'error',
      sort: 1,
      daysRemaining: 0,
    };
  }

  if (hasExpiring) {
    return {
      status: 'expiring' as const,
      label: 'Expiring',
      color: 'warning',
      sort: 2,
      daysRemaining: Number.isFinite(minDaysRemaining) ? minDaysRemaining : undefined,
    };
  }

  return {
    status: 'active' as const,
    label: 'Active',
    color: 'success',
    sort: 3,
    daysRemaining: Number.isFinite(minDaysRemaining) ? minDaysRemaining : undefined,
  };
};

export const formatServerName = (server?: string) => {
  if (!server) return '-';
  return server
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

export const formatFaction = (faction?: 'alliance' | 'horde') => {
  if (faction === 'alliance') return 'A';
  if (faction === 'horde') return 'H';
  return '';
};

export const parseStatusFilterFromParams = (params: URLSearchParams): StatusFilter => {
  const value = params.get('status');
  return value && STATUS_FILTER_VALUES.includes(value as BotStatus)
    ? (value as BotStatus)
    : 'all';
};

export const formatDaysRemaining = (daysRemaining: number | undefined) => {
  if (typeof daysRemaining !== 'number') return '-';
  const label = daysRemaining === 1 ? 'Day' : 'Days';
  return `${daysRemaining} ${label} left`;
};
