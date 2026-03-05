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
  status?: 'none' | 'active' | 'expiring' | 'expired' | 'banned';
  label?: string;
  color?: string;
  sort?: number;
  days_remaining?: number;
};

type BackendResourceProjectionByBot = Record<
  string,
  {
    license_status?: ComputedStatusPayload;
    proxy_status?: ComputedStatusPayload;
    subscription_status?: ComputedStatusPayload;
  }
>;

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

function defaultResourceProjection() {
  return {
    status: 'none' as const,
    label: 'None',
    color: 'default',
    sort: 5,
    daysRemaining: undefined,
  };
}

function mapBackendProjection(entry: ComputedStatusPayload | undefined) {
  if (!entry) {
    return defaultResourceProjection();
  }
  return {
    status:
      entry.status === 'active' ||
      entry.status === 'expiring' ||
      entry.status === 'expired' ||
      entry.status === 'banned'
        ? entry.status
        : ('none' as const),
    label: entry.label || 'None',
    color: entry.color || 'default',
    sort: typeof entry.sort === 'number' ? entry.sort : 5,
    daysRemaining: entry.days_remaining,
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
  resourceStatusByBot,
}: {
  bots: Record<string, BotRecord>;
  projectId: string;
  resourceStatusByBot?: BackendResourceProjectionByBot;
}): BotRow[] {
  if (!projectId) return [];

  return Object.entries(bots)
    .filter(([, bot]) => bot.project_id === projectId)
    .map(([botId, bot]) => {
      const computedStatus = toBotStatus(bot.computed_status) || 'offline';
      const backendProjection = resourceStatusByBot?.[botId];
      const licenseStatus = mapBackendProjection(backendProjection?.license_status);
      const proxyStatus = mapBackendProjection(backendProjection?.proxy_status);
      const subscriptionStatus = mapBackendProjection(backendProjection?.subscription_status);

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
        subscriptionStatus:
          subscriptionStatus.status === 'banned' ? 'expired' : subscriptionStatus.status,
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
