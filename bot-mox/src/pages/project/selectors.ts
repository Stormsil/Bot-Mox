import type { BotLicense, Proxy, Subscription } from '../../types';
import {
  type BotRecord,
  type BotRow,
  type ProjectStats,
  type ProxyLike,
  type ResourcesByBotMaps,
  type StatusFilter,
} from './types';
import {
  computeBotStatus,
  computeLicenseStatus,
  computeProxyStatus,
  computeSubscriptionStatus,
} from './utils';

export function buildResourcesByBotMaps({
  proxies,
  subscriptions,
  licenses,
}: {
  proxies: Proxy[];
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

      const computedStatus = computeBotStatus(bot);
      const licenseStatus = computeLicenseStatus(botLicenses, warningDays);
      const proxyStatus = computeProxyStatus(proxy);
      const subscriptionStatus = computeSubscriptionStatus(botSubscriptions, warningDays);

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

export function filterBotRows(rows: BotRow[], searchText: string, statusFilter: StatusFilter): BotRow[] {
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
      value ? value.toLowerCase().includes(normalizedSearch) : false
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
      row.botStatus === 'leveling'
      || row.botStatus === 'profession'
      || row.botStatus === 'farming'
  ).length;

  return { total, active, prepare, offline, banned };
}
