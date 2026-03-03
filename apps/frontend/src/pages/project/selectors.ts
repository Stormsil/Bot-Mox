import { normalizeResourceStatusVocabulary } from '../../entities/resources/model/statusVocabulary';
import type {
  BotLicense,
  Proxy as ProxyResource,
  Subscription,
} from '../../entities/resources/model/types';
import type { BotStatus } from '../../shared/types/core';
import type {
  BotRecord,
  BotRow,
  ProjectStats,
  ProxyLike,
  ResourcesByBotMaps,
  StatusFilter,
} from './types';

type ComputedStatusPayload = {
  computed_status?: string;
  status?: string;
  days_remaining?: number | null;
  is_expiring_soon?: boolean;
};

function hasStatusVocabulary(value: unknown): value is ComputedStatusPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as ComputedStatusPayload;
  return typeof candidate.computed_status === 'string' || typeof candidate.status === 'string';
}

function toBotStatus(value: unknown): BotStatus | undefined {
  if (
    value === 'offline' ||
    value === 'prepare' ||
    value === 'leveling' ||
    value === 'profession' ||
    value === 'farming' ||
    value === 'banned'
  ) {
    return value;
  }
  return undefined;
}

function buildProxyStatus(proxy?: ProxyResource | ProxyLike) {
  if (hasStatusVocabulary(proxy)) {
    const normalized = normalizeResourceStatusVocabulary(proxy);
    const computed = normalized.computedStatus || normalized.statusToken;
    const daysRemaining = normalized.daysRemaining;

    if (computed === 'banned') {
      return {
        status: 'banned' as const,
        label: 'Banned',
        color: 'error',
        sort: 1,
        daysRemaining: 0,
      };
    }

    if (computed === 'expired') {
      return {
        status: 'expired' as const,
        label: 'Expired',
        color: 'error',
        sort: 2,
        daysRemaining: 0,
      };
    }

    if (computed === 'expiring') {
      return {
        status: 'expiring' as const,
        label: 'Expiring',
        color: 'warning',
        sort: 3,
        daysRemaining,
      };
    }

    if (computed === 'active') {
      return {
        status: 'active' as const,
        label: 'Active',
        color: 'success',
        sort: 4,
        daysRemaining,
      };
    }
  }

  if (!proxy) {
    return {
      status: 'none' as const,
      label: 'None',
      color: 'default',
      sort: 5,
      daysRemaining: undefined,
    };
  }

  return {
    status: 'none' as const,
    label: 'None',
    color: 'default',
    sort: 5,
    daysRemaining: undefined,
  };
}

function buildAggregateResourceStatus(
  resources: ComputedStatusPayload[],
  _warningDays: number,
  activeSort: number,
) {
  if (!resources.length) {
    return {
      status: 'none' as const,
      label: 'None',
      color: 'default',
      sort: 5,
      daysRemaining: undefined as number | undefined,
    };
  }

  if (
    resources.some((item) => {
      const normalized = normalizeResourceStatusVocabulary(item);
      return normalized.computedStatus === 'expired' || normalized.statusToken === 'expired';
    })
  ) {
    return {
      status: 'expired' as const,
      label: 'Expired',
      color: 'error',
      sort: 1,
      daysRemaining: 0,
    };
  }

  const expiring = resources.filter((item) => {
    const normalized = normalizeResourceStatusVocabulary(item);
    return normalized.computedStatus === 'expiring' || normalized.isExpiringSoon;
  });
  if (expiring.length > 0) {
    const minDaysRemaining = expiring
      .map((item) => normalizeResourceStatusVocabulary(item).daysRemaining)
      .find((value) => value !== undefined);
    return {
      status: 'expiring' as const,
      label: 'Expiring',
      color: 'warning',
      sort: 2,
      daysRemaining: minDaysRemaining,
    };
  }

  const minDaysRemaining = resources
    .map((item) => normalizeResourceStatusVocabulary(item).daysRemaining)
    .find((value) => value !== undefined);

  return {
    status: 'active' as const,
    label: 'Active',
    color: 'success',
    sort: activeSort,
    daysRemaining: minDaysRemaining,
  };
}

export function buildResourcesByBotMaps({
  proxies,
  subscriptions,
  licenses,
}: {
  proxies: ProxyResource[];
  subscriptions: Subscription[];
  licenses: BotLicense[];
}): ResourcesByBotMaps {
  const proxiesByBot = new Map<string, ProxyLike>();
  proxies.forEach((proxy) => {
    if (proxy.bot_id) {
      proxiesByBot.set(proxy.bot_id, proxy);
    }
  });

  const subscriptionsByBot = new Map<string, Subscription[]>();
  subscriptions.forEach((sub) => {
    if (!subscriptionsByBot.has(sub.bot_id)) {
      subscriptionsByBot.set(sub.bot_id, []);
    }
    subscriptionsByBot.get(sub.bot_id)?.push(sub);
  });

  const licensesByBot = new Map<string, BotLicense[]>();
  licenses.forEach((license) => {
    (license.bot_ids || []).forEach((botId) => {
      if (!licensesByBot.has(botId)) {
        licensesByBot.set(botId, []);
      }
      licensesByBot.get(botId)?.push(license);
    });
  });

  return {
    proxiesByBot,
    subscriptionsByBot,
    licensesByBot,
  };
}

export function buildBotRows({
  bots,
  projectId,
  warningDays,
  resourcesByBot,
}: {
  bots: Record<string, BotRecord>;
  projectId: string;
  warningDays: number;
  resourcesByBot: ResourcesByBotMaps;
}): BotRow[] {
  if (!projectId) return [];

  const { proxiesByBot, subscriptionsByBot, licensesByBot } = resourcesByBot;

  return Object.entries(bots)
    .filter(([, bot]) => bot.project_id === projectId)
    .map(([botId, bot]) => {
      const proxy = proxiesByBot.get(botId) || bot.proxy;
      const botSubscriptions = subscriptionsByBot.get(botId) || [];
      const botLicenses = licensesByBot.get(botId) || [];

      const computedStatus = toBotStatus(bot.computed_status) || 'offline';
      const licenseStatus = buildAggregateResourceStatus(botLicenses, warningDays, 3);
      const proxyStatus = buildProxyStatus(proxy);
      const subscriptionStatus = buildAggregateResourceStatus(botSubscriptions, warningDays, 3);

      return {
        id: botId,
        idShort: botId.slice(0, 8),
        characterName: bot.character?.name || bot.name || 'Unknown',
        level: bot.character?.level,
        email: bot.account?.email,
        password: bot.account?.password,
        server: bot.character?.server,
        faction: bot.character?.faction,
        vmName: bot.vm?.name,
        botStatus: computedStatus,
        licenseStatusLabel: licenseStatus.label,
        licenseStatusColor: licenseStatus.color,
        licenseSort: licenseStatus.sort,
        licenseDaysRemaining: licenseStatus.daysRemaining,
        proxyStatus: proxyStatus.status,
        proxyStatusLabel: proxyStatus.label,
        proxyStatusColor: proxyStatus.color,
        proxySort: proxyStatus.sort,
        proxyDaysRemaining: proxyStatus.daysRemaining,
        subscriptionStatus: subscriptionStatus.status,
        subscriptionStatusLabel: subscriptionStatus.label,
        subscriptionStatusColor: subscriptionStatus.color,
        subscriptionSort: subscriptionStatus.sort,
        subscriptionDaysRemaining: subscriptionStatus.daysRemaining,
      };
    });
}

export function filterBotRows(
  rows: BotRow[],
  searchText: string,
  statusFilter: StatusFilter,
): BotRow[] {
  const normalizedSearch = searchText.trim().toLowerCase();

  return rows.filter((row) => {
    const matchesStatus = statusFilter === 'all' || row.botStatus === statusFilter;

    if (!normalizedSearch) {
      return matchesStatus;
    }

    const searchTargets = [
      row.id,
      row.idShort,
      row.characterName,
      row.email,
      row.password,
      row.server,
      row.vmName,
    ];

    const matchesSearch = searchTargets.some((value) =>
      value ? value.toLowerCase().includes(normalizedSearch) : false,
    );

    return matchesSearch && matchesStatus;
  });
}

export function buildProjectStats(rows: BotRow[]): ProjectStats {
  const total = rows.length;
  const banned = rows.filter((row) => row.botStatus === 'banned').length;
  const prepare = rows.filter((row) => row.botStatus === 'prepare').length;
  const offline = rows.filter((row) => row.botStatus === 'offline').length;
  const active = rows.filter(
    (row) =>
      row.botStatus === 'leveling' || row.botStatus === 'profession' || row.botStatus === 'farming',
  ).length;

  return { total, active, prepare, offline, banned };
}
