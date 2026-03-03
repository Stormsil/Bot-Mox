import { normalizeResourceStatusVocabulary } from '../../entities/resources/model/statusVocabulary';
import type { Proxy as ProxyResource } from '../../entities/resources/model/types';
import type { ProxyWithBot } from './proxyColumns';

export const DEFAULT_PROVIDERS = ['IPRoyal', 'Smartproxy', 'Luminati', 'Oxylabs'];
export const STATS_COLLAPSED_KEY = 'proxiesStatsCollapsed';

export type ProxiesBotMap = Record<
  string,
  {
    character?: { name?: string };
    person?: { name?: string; vm_name?: string };
    vm?: { name?: string };
    name?: string;
  }
>;

export function mapProxiesWithBots(proxies: ProxyResource[], bots: ProxiesBotMap): ProxyWithBot[] {
  return proxies.map((proxy) => {
    const bot = proxy.bot_id ? bots[proxy.bot_id] : undefined;
    const characterName = bot?.character?.name;
    const vmName = bot?.vm?.name;

    return {
      ...proxy,
      botName: characterName || bot?.name,
      botCharacter: characterName,
      botVMName: vmName,
    } as ProxyWithBot;
  });
}

export function filterProxies(
  proxies: ProxyWithBot[],
  filters: {
    searchText: string;
    statusFilter: string;
    typeFilter: string;
    countryFilter: string;
  },
): ProxyWithBot[] {
  const normalizedSearch = filters.searchText.toLowerCase();

  return proxies.filter((proxy) => {
    const matchesSearch =
      proxy.ip.toLowerCase().includes(normalizedSearch) ||
      proxy.provider.toLowerCase().includes(normalizedSearch) ||
      (proxy.botName?.toLowerCase().includes(normalizedSearch) ?? false) ||
      proxy.country.toLowerCase().includes(normalizedSearch) ||
      (proxy.isp?.toLowerCase().includes(normalizedSearch) ?? false);

    const matchesStatus = filters.statusFilter === 'all' || proxy.status === filters.statusFilter;
    const matchesType = filters.typeFilter === 'all' || proxy.type === filters.typeFilter;
    const matchesCountry =
      filters.countryFilter === 'all' || proxy.country === filters.countryFilter;

    return matchesSearch && matchesStatus && matchesType && matchesCountry;
  });
}

export function buildProxyStats(proxies: ProxyWithBot[]): {
  total: number;
  active: number;
  expired: number;
  expiringSoon: number;
  unassigned: number;
} {
  return {
    total: proxies.length,
    active: proxies.filter((proxy) => {
      const status = normalizeResourceStatusVocabulary(proxy);
      return (
        (status.computedStatus === 'active' || status.statusToken === 'active') &&
        status.computedStatus !== 'expired' &&
        status.statusToken !== 'expired'
      );
    }).length,
    expired: proxies.filter((proxy) => {
      const status = normalizeResourceStatusVocabulary(proxy);
      return status.computedStatus === 'expired' || status.statusToken === 'expired';
    }).length,
    expiringSoon: proxies.filter((proxy) => normalizeResourceStatusVocabulary(proxy).isExpiringSoon)
      .length,
    unassigned: proxies.filter((proxy) => !proxy.bot_id).length,
  };
}

export function extractCountries(proxies: ProxyWithBot[]): string[] {
  return [...new Set(proxies.map((proxy) => proxy.country).filter(Boolean))];
}
