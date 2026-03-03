import type { BotStatus } from '../../../shared/types/core';

export type ResourceKind = 'licenses' | 'proxies' | 'subscriptions';

export interface BotLicense {
  id: string;
  key: string;
  type: string;
  status: 'active' | 'expired' | 'revoked';
  bot_ids: string[];
  bot_names?: string[];
  expires_at: number;
  created_at: number;
  updated_at: number;
  computed_status?: 'active' | 'expiring' | 'expired';
  days_remaining?: number | null;
  is_expiring_soon?: boolean;
}

export interface LicenseBotName {
  id: string;
  name: string;
  created_at: number;
}

export interface LicenseWithBots extends BotLicense {
  botDetails?: Array<{
    id: string;
    name: string;
    characterName?: string;
    vmName?: string;
    fullDisplay?: string;
  }>;
}

export interface Proxy {
  id: string;
  ip: string;
  port: number;
  login: string;
  password: string;
  provider: string;
  country: string;
  country_code?: string;
  type: 'http' | 'socks5';
  status: 'active' | 'expired' | 'banned';
  bot_id: string | null;
  fraud_score: number;
  vpn?: boolean;
  proxy?: boolean;
  tor?: boolean;
  bot_status?: boolean;
  isp?: string;
  organization?: string;
  city?: string;
  region?: string;
  zip_code?: string;
  timezone?: string;
  latitude?: number;
  longitude?: number;
  expires_at: number;
  created_at: number;
  updated_at: number;
  last_checked?: number;
  computed_status?: 'active' | 'expiring' | 'expired' | 'banned';
  days_remaining?: number | null;
  is_expiring_soon?: boolean;
}

export interface IPQSResponse {
  success: boolean;
  message?: string;
  fraud_score: number;
  country_code: string;
  region: string;
  city: string;
  zip_code: string;
  isp: string;
  organization: string;
  timezone: string;
  latitude: number;
  longitude: number;
  vpn: boolean;
  proxy: boolean;
  tor: boolean;
  bot_status: boolean;
  bot?: boolean;
  [key: string]: unknown;
}

export type SubscriptionType = 'wow' | 'bot' | 'proxy' | 'vpn' | 'other';
export type SubscriptionDbStatus = 'active' | 'cancelled';
export type ComputedSubscriptionStatus = 'active' | 'expiring_soon' | 'expired';

export interface Subscription {
  id: string;
  type: SubscriptionType;
  status: SubscriptionDbStatus;
  expires_at: number;
  created_at: number;
  updated_at: number;
  bot_id: string;
  account_email?: string;
  auto_renew?: boolean;
  project_id?: 'wow_tbc' | 'wow_midnight';
  notes?: string;
  computed_status?: 'active' | 'expiring' | 'expired';
  days_remaining?: number | null;
  is_expiring_soon?: boolean;
}

export interface SubscriptionWithDetails extends Subscription {
  computedStatus: ComputedSubscriptionStatus;
  daysRemaining: number;
  isExpired: boolean;
  isExpiringSoon: boolean;
  botName?: string;
  botCharacter?: string;
  botStatus?: BotStatus;
  botVmName?: string;
}

export interface SubscriptionSettings {
  warning_days: number;
  updated_at: number;
  updated_by?: string;
}

export interface SubscriptionFormData {
  bot_id: string;
  type: SubscriptionType;
  expires_at: string;
  account_email?: string;
  auto_renew?: boolean;
  project_id?: 'wow_tbc' | 'wow_midnight';
  notes?: string;
}

export interface SubscriptionSummary {
  total_active: number;
  total_expired: number;
  by_type: Record<
    string,
    {
      active_count: number;
      expired_count: number;
      total_count: number;
    }
  >;
  expiring_soon: Record<
    string,
    {
      id: string;
      bot_id: string;
      type: string;
      expires_at: number;
      days_remaining: number;
    }
  >;
  last_updated: number;
}
