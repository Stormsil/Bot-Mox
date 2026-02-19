import type { AlertProps } from 'antd';
import type React from 'react';
import type { Bot, BotLicense, Proxy as ProxyResource, Subscription } from '../../../types';

export interface BotSummaryBot extends Bot {
  account?: {
    email?: string;
    password?: string;
    mail_provider?: string;
    bnet_created_at?: number;
    mail_created_at?: number;
  };
  person?: {
    first_name?: string;
    last_name?: string;
    birth_date?: string;
    country?: string;
    city?: string;
    address?: string;
    zip?: string;
  };
  vm?: {
    name?: string;
    ip?: string;
    created_at?: string;
  };
  proxy?: {
    ip?: string;
    port?: number;
    provider?: string;
    country?: string;
    expires_at?: number;
    status?: ProxyResource['status'];
  };
  schedule?: unknown;
  updated_at?: number;
  created_at?: number;
}

export interface BotSummaryProps {
  bot: BotSummaryBot;
}

export type SummaryMainTab = 'summary' | 'monitoring' | 'configure' | 'resources' | 'vmInfo';
export type SummaryConfigureTab = 'schedule' | 'account' | 'character' | 'person';
export type SummaryResourcesTab = 'license' | 'proxy' | 'subscription';

export interface BotStatusInfo {
  licenseExpired: boolean;
  licenseExpiringSoon: boolean;
  proxyExpired: boolean;
  proxyExpiringSoon: boolean;
  proxyBanned: boolean;
  subscriptionsExpired: number;
  subscriptionsExpiringSoon: number;
  isOffline: boolean;
  lastSeenMinutes: number;
}

export interface ProxyDetails {
  ip?: string;
  port?: number;
  status?: ProxyResource['status'];
  expires_at?: number;
  provider?: string;
  country?: string;
}

export interface LinkedResources {
  license: BotLicense | null;
  proxy: ProxyDetails | null;
  subscriptions: Subscription[];
}

export interface HealthStatus {
  status: AlertProps['type'];
  message: string;
  icon: React.ReactNode;
}

export type ScheduleSessionState = { enabled?: boolean };
export type ScheduleEntryState =
  | ScheduleSessionState[]
  | {
      enabled?: boolean;
      sessions?: ScheduleSessionState[];
    };

export interface ScheduleStats {
  totalSessions: number;
  enabledSessions: number;
  daysConfigured: number;
}

export interface SubscriptionSummary {
  total: number;
  activeCount: number;
  nextExpiry?: Subscription;
}
