import React from 'react';
import {
  CalendarOutlined,
  CheckCircleOutlined,
  DesktopOutlined,
  ExclamationCircleOutlined,
  KeyOutlined,
  UserOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { Spin } from 'antd';
import dayjs from 'dayjs';
import type { Subscription } from '../../../types';
import type {
  BotStatusInfo,
  BotSummaryBot,
  HealthStatus,
  ScheduleEntryState,
  ScheduleSessionState,
  ScheduleStats,
  SubscriptionSummary,
} from './types';

export const SUMMARY_SECTIONS = [
  { key: 'overview', label: 'Overview', icon: <CheckCircleOutlined /> },
  { key: 'character', label: 'Character', icon: <UserOutlined /> },
  { key: 'bot', label: 'Bot Info', icon: <DesktopOutlined /> },
  { key: 'configure', label: 'Configure', icon: <CalendarOutlined /> },
  { key: 'resources', label: 'Resources', icon: <KeyOutlined /> },
];

export function getHealthStatus(statusInfo: BotStatusInfo | null): HealthStatus {
  if (!statusInfo) {
    return { status: 'info', message: 'Checking...', icon: <Spin size="small" /> };
  }

  const criticalIssues = [
    statusInfo.licenseExpired,
    statusInfo.proxyExpired,
    statusInfo.proxyBanned,
    statusInfo.subscriptionsExpired > 0,
  ].filter(Boolean).length;

  const warnings = [
    statusInfo.licenseExpiringSoon,
    statusInfo.proxyExpiringSoon,
    statusInfo.subscriptionsExpiringSoon > 0,
    statusInfo.isOffline,
  ].filter(Boolean).length;

  if (criticalIssues > 0) {
    return {
      status: 'error',
      message: `${criticalIssues} critical issue(s)`,
      icon: <ExclamationCircleOutlined />,
    };
  }

  if (warnings > 0) {
    return {
      status: 'warning',
      message: `${warnings} warning(s)`,
      icon: <WarningOutlined />,
    };
  }

  return {
    status: 'success',
    message: 'All systems operational',
    icon: <CheckCircleOutlined />,
  };
}

export function formatProjectName(projectId: BotSummaryBot['project_id']) {
  if (projectId === 'wow_tbc') return 'WoW TBC';
  if (projectId === 'wow_midnight') return 'WoW Midnight';
  return projectId;
}

export function formatDate(timestamp?: number) {
  if (!timestamp) return '—';
  return dayjs(timestamp).format('DD.MM.YYYY');
}

export function formatDaysLeft(timestamp?: number) {
  if (!timestamp) return '—';
  const daysLeft = Math.ceil((timestamp - Date.now()) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) return 'Expired';
  return `${daysLeft} Day${daysLeft === 1 ? '' : 's'} left`;
}

export function formatCompactKey(value?: string) {
  if (!value) return '—';
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export function calculateScheduleStats(schedule: unknown): ScheduleStats {
  if (!schedule || typeof schedule !== 'object') {
    return { totalSessions: 0, enabledSessions: 0, daysConfigured: 0 };
  }

  const scheduleRecord = schedule as Record<string, unknown>;
  const rawDayEntries: unknown[] =
    scheduleRecord?.days && typeof scheduleRecord.days === 'object'
      ? Object.values(scheduleRecord.days as Record<string, unknown>)
      : Object.values(scheduleRecord);
  const dayEntries = rawDayEntries as ScheduleEntryState[];

  const sessionsList = dayEntries.flatMap((entry): ScheduleSessionState[] => {
    if (Array.isArray(entry)) {
      return entry;
    }
    if (entry && typeof entry === 'object' && Array.isArray(entry.sessions)) {
      return entry.sessions;
    }
    return [];
  });

  const totalSessions = sessionsList.length;
  const enabledSessions = sessionsList.filter((entry) => entry?.enabled).length;

  const daysConfigured = dayEntries.reduce((count: number, entry) => {
    if (Array.isArray(entry)) {
      return count + (entry.some((session) => session?.enabled) ? 1 : 0);
    }
    if (entry && typeof entry === 'object' && Array.isArray(entry.sessions)) {
      return count + (entry.sessions.some((session) => session?.enabled) ? 1 : 0);
    }
    if (entry && typeof entry.enabled === 'boolean') {
      return count + (entry.enabled ? 1 : 0);
    }
    return count;
  }, 0);

  return { totalSessions, enabledSessions, daysConfigured };
}

export function calculateSubscriptionSummary(subscriptions: Subscription[]): SubscriptionSummary {
  const now = Date.now();
  const total = subscriptions.length;
  const active = subscriptions.filter((sub) => sub.expires_at > now);
  const nextExpiry = active.sort((a, b) => a.expires_at - b.expires_at)[0];
  return {
    total,
    activeCount: active.length,
    nextExpiry,
  };
}
