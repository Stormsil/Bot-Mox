import type { BotLicense, LicenseWithBots } from '../../../types';
import type { BotsMap, LicensesStats } from './types';

export const STATS_COLLAPSED_KEY = 'licensesStatsCollapsed';
export const ONE_DAY_MS = 1000 * 60 * 60 * 24;

export const getCurrentTimestamp = (): number => Date.now();

export const isExpired = (expiresAt: number, currentTime: number) => currentTime > expiresAt;

export const isExpiringSoon = (expiresAt: number, currentTime: number) => {
  const daysUntilExpiry = Math.ceil((expiresAt - currentTime) / ONE_DAY_MS);
  return daysUntilExpiry <= 3 && daysUntilExpiry > 0;
};

export const withBotDetails = (licenses: LicenseWithBots[], bots: BotsMap): LicenseWithBots[] =>
  licenses.map((license) => {
    const botDetails = (license.bot_ids || []).map((botId) => {
      const bot = bots[botId];
      const characterName = bot?.character?.name;
      const vmName = bot?.vm?.name;
      const botName = bot?.name || botId.substring(0, 8);
      return {
        id: botId,
        name: characterName || botName,
        characterName,
        vmName,
        fullDisplay: characterName
          ? vmName
            ? `${characterName} (${vmName})`
            : characterName
          : botName,
      };
    });

    return { ...license, botDetails };
  });

export const filterLicenses = (
  licenses: LicenseWithBots[],
  searchText: string,
  statusFilter: string,
  typeFilter: string,
) =>
  licenses.filter((license) => {
    const search = searchText.toLowerCase();
    const matchesSearch =
      license.key.toLowerCase().includes(search) ||
      license.botDetails?.some((bot) => bot.name?.toLowerCase().includes(search)) ||
      license.botDetails?.some((bot) => bot.characterName?.toLowerCase().includes(search));

    const matchesStatus = statusFilter === 'all' || license.status === statusFilter;
    const matchesType = typeFilter === 'all' || license.type === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

export const computeStats = (licenses: LicenseWithBots[], currentTime: number): LicensesStats => ({
  total: licenses.length,
  active: licenses.filter(
    (license) => license.status === 'active' && !isExpired(license.expires_at, currentTime),
  ).length,
  expired: licenses.filter((license) => isExpired(license.expires_at, currentTime)).length,
  expiringSoon: licenses.filter((license) => isExpiringSoon(license.expires_at, currentTime))
    .length,
  unassigned: licenses.filter((license) => !license.bot_ids || license.bot_ids.length === 0).length,
});

export const buildLicensePayload = (
  values: { key: string; type: string; expires_at: { valueOf: () => number } },
  now: number,
  botIds: string[],
) => {
  const expiresAt = values.expires_at.valueOf();
  const status: BotLicense['status'] = now > expiresAt ? 'expired' : 'active';

  return {
    key: values.key,
    type: values.type,
    status,
    bot_ids: botIds,
    expires_at: expiresAt,
    updated_at: now,
  };
};
