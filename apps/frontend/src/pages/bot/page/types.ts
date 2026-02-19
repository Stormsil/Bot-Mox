import type { ReactNode } from 'react';
import type { Bot } from '../../../types';

export interface ExtendedBot extends Bot {
  vm?: {
    name: string;
    ip: string;
    created_at: string;
  };
  account?: {
    email: string;
    password: string;
    mail_provider: string;
    bnet_created_at: number;
    mail_created_at: number;
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
  proxy?: {
    full_string: string;
    type: string;
    ip: string;
    port: number;
    login: string;
    password: string;
    provider: string;
    country: string;
    fraud_score: number;
    VPN: boolean;
    Proxy: boolean;
    detect_country: boolean;
    created_at: number;
    expires_at: number;
  };
  leveling?: {
    current_level: number;
    target_level: number;
    xp_current: number;
    xp_required: number;
    xp_per_hour: number;
    estimated_time_to_level: number;
    location: string;
    sub_location: string;
    started_at: number;
    finished_at: number;
  };
  professions?: Record<
    string,
    {
      name: string;
      skill_points: number;
      max_skill_points: number;
      started_at: number;
      finished_at: number;
    }
  >;
  schedule?: Record<
    string,
    Array<{
      start: string;
      end: string;
      enabled: boolean;
      profile: string;
    }>
  >;
  farm?: {
    total_gold: number;
    gold_per_hour: number;
    session_start: number;
    location: string;
    profile: string;
    all_farmed_gold: number;
  };
  finance?: {
    total_farmed_usd: number;
    total_expenses_usd: number;
    roi_percent: number;
  };
  monitor?: {
    screenshot_request: boolean;
    screenshot_url: string | null;
    screenshot_timestamp: number | null;
    status: string;
  };
  updated_at?: number;
  created_at?: number;
}

export type ScheduleSessionState = { enabled?: boolean };
export type ScheduleEntryState =
  | ScheduleSessionState[]
  | {
      enabled?: boolean;
      sessions?: ScheduleSessionState[];
    };

export type MainTab = 'summary' | 'monitoring' | 'configure' | 'resources' | 'vmInfo';
export type ConfigureTab = 'schedule' | 'account' | 'character' | 'person';
export type ResourcesTab = 'license' | 'proxy' | 'subscription';

export interface ConfigureSection {
  key: ConfigureTab;
  label: string;
  description: string;
  complete: boolean;
  content: ReactNode;
}

export interface ResourceSection {
  key: ResourcesTab;
  content: ReactNode;
}
