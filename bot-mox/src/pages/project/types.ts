import type { BotLicense, BotStatus, Proxy, Subscription } from '../../types';

export const OFFLINE_THRESHOLD_MS = 5 * 60 * 1000;

export type StatusFilter = 'all' | BotStatus;

export type ProxyStatus = 'none' | 'active' | 'expiring' | 'expired' | 'banned';
export type SubscriptionStatus = 'none' | 'active' | 'expiring' | 'expired';

export type ProxyLike = {
  expires_at?: number;
  status?: Proxy['status'];
};

export interface BotRecord {
  id: string;
  project_id: string;
  status: BotStatus;
  last_seen?: number;
  name?: string;
  character?: {
    name?: string;
    level?: number;
    server?: string;
    faction?: 'alliance' | 'horde';
  };
  account?: {
    email?: string;
    password?: string;
  };
  proxy?: ProxyLike;
  vm?: {
    name?: string;
  };
}

export interface BotRow {
  id: string;
  idShort: string;
  characterName: string;
  level?: number;
  email?: string;
  password?: string;
  server?: string;
  faction?: 'alliance' | 'horde';
  vmName?: string;
  botStatus: BotStatus;
  licenseStatusLabel: string;
  licenseStatusColor: string;
  licenseSort: number;
  licenseDaysRemaining?: number;
  proxyStatus: ProxyStatus;
  proxyStatusLabel: string;
  proxyStatusColor: string;
  proxySort: number;
  proxyDaysRemaining?: number;
  subscriptionStatus: SubscriptionStatus;
  subscriptionStatusLabel: string;
  subscriptionStatusColor: string;
  subscriptionSort: number;
  subscriptionDaysRemaining?: number;
}

export interface ProjectStats {
  total: number;
  active: number;
  prepare: number;
  offline: number;
  banned: number;
}

export const BOT_STATUS_ORDER: Record<BotStatus, number> = {
  banned: 1,
  offline: 2,
  prepare: 3,
  leveling: 4,
  profession: 5,
  farming: 6,
};

export const STATUS_FILTER_VALUES: BotStatus[] = [
  'offline',
  'prepare',
  'leveling',
  'profession',
  'farming',
  'banned',
];

export type ResourcesByBotMaps = {
  proxiesByBot: Map<string, Proxy | ProxyLike>;
  subscriptionsByBot: Map<string, Subscription[]>;
  licensesByBot: Map<string, BotLicense[]>;
};
