import { normalizeResourceStatusVocabulary } from '../../../entities/resources/model/statusVocabulary';
import type { BotLicense, LicenseWithBots } from '../../../entities/resources/model/types';
import type { BotsMap, LicensesStats } from './types';

export const STATS_COLLAPSED_KEY = 'licensesStatsCollapsed';

export const getCurrentTimestamp = (): number => Date.now();

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

export const computeStats = (licenses: LicenseWithBots[]): LicensesStats => ({
  total: licenses.length,
  active: licenses.filter((license) => {
    const status = normalizeResourceStatusVocabulary(license);
    return (
      (status.computedStatus === 'active' || status.statusToken === 'active') &&
      status.computedStatus !== 'expired' &&
      status.statusToken !== 'expired'
    );
  }).length,
  expired: licenses.filter((license) => {
    const status = normalizeResourceStatusVocabulary(license);
    return status.computedStatus === 'expired' || status.statusToken === 'expired';
  }).length,
  expiringSoon: licenses.filter(
    (license) => normalizeResourceStatusVocabulary(license).isExpiringSoon,
  ).length,
  unassigned: licenses.filter((license) => !license.bot_ids || license.bot_ids.length === 0).length,
});

export const buildLicensePayload = (
  values: { key: string; type: string; expires_at: { valueOf: () => number } },
  now: number,
  botIds: string[],
  status: BotLicense['status'] = 'active',
) => {
  const expiresAt = values.expires_at.valueOf();

  return {
    key: values.key,
    type: values.type,
    status,
    bot_ids: botIds,
    expires_at: expiresAt,
    updated_at: now,
  };
};
