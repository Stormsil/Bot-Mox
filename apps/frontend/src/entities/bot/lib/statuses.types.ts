import type { BotStatus } from '../../../shared/types/core';
import type { Proxy as ProxyResource } from '../../resources/model/types';

export const OFFLINE_THRESHOLD_MS = 5 * 60 * 1000;

export type ProxyStatus = 'none' | 'active' | 'expiring' | 'expired' | 'banned';
export type SubscriptionStatus = 'none' | 'active' | 'expiring' | 'expired';

export type ProxyLike = {
  expires_at?: number;
  status?: ProxyResource['status'];
  computed_status?: 'active' | 'expiring' | 'expiring_soon' | 'expired' | 'banned';
  days_remaining?: number | null;
  is_expiring_soon?: boolean;
};

export interface BotRecord {
  id: string;
  project_id: string;
  status: BotStatus;
  last_seen?: number;
  computed_status: BotStatus;
  days_remaining: number | null;
  is_expiring_soon: boolean;
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
