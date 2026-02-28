import type { BotStatus } from '../../types/core';
import { STATUS_FILTER_VALUES, type StatusFilter } from './types';

export const formatProjectTitle = (projectId: string) =>
  projectId.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export const formatServerName = (server?: string) => {
  if (!server) return '-';
  return server
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

export const formatFaction = (faction?: 'alliance' | 'horde') => {
  if (faction === 'alliance') return 'A';
  if (faction === 'horde') return 'H';
  return '';
};

export const parseStatusFilterFromParams = (params: URLSearchParams): StatusFilter => {
  const value = params.get('status');
  return value && STATUS_FILTER_VALUES.includes(value as BotStatus) ? (value as BotStatus) : 'all';
};

export const formatDaysRemaining = (daysRemaining: number | undefined) => {
  if (typeof daysRemaining !== 'number') return '-';
  const label = daysRemaining === 1 ? 'Day' : 'Days';
  return `${daysRemaining} ${label} left`;
};
