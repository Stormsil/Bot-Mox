import type React from 'react';

export type ContentMapSection = 'projects' | 'resources' | 'finance_notes' | 'expiring';

export interface ProjectStats {
  total: number;
  active: number;
  prepare: number;
  offline: number;
  banned: number;
}

export interface ExpiringItem {
  id: string;
  type: 'license' | 'proxy' | 'subscription';
  name: string;
  botName?: string;
  daysRemaining: number;
  expiresAt: number;
}

export type NavPropsFactory = (path: string) => {
  role: 'button';
  tabIndex: number;
  onClick: () => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
};

export interface DatacenterLoadingState {
  bots: boolean;
  licenses: boolean;
  proxies: boolean;
  subscriptions: boolean;
  finance: boolean;
  notes: boolean;
}

export interface DatacenterProjectStatsState {
  all: ProjectStats;
  wow_tbc: ProjectStats;
  wow_midnight: ProjectStats;
}

export interface DatacenterResourceStats {
  total: number;
  active: number;
  expiringSoon: number;
  expired: number;
}

export interface DatacenterLicenseProxyStats extends DatacenterResourceStats {
  unassigned: number;
}
