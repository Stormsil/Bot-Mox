import type { Bot, BotStatus } from '../../types';
import type { ContentMapSection, ProjectStats } from './content-map';

export const OFFLINE_THRESHOLD_MS = 5 * 60 * 1000;
export const FINANCE_WINDOW_DAYS = 30;
export const MS_PER_DAY = 1000 * 60 * 60 * 24;
export const CONTENT_MAP_COLLAPSE_KEY = 'contentMapCollapsedSections';

export const DEFAULT_COLLAPSED_SECTIONS: Record<ContentMapSection, boolean> = {
  projects: false,
  resources: false,
  finance_notes: false,
  expiring: false,
};

export const computeBotStatus = (bot: Bot, currentTime: number): BotStatus => {
  if (bot.status === 'banned') return 'banned';
  if (bot.last_seen && currentTime - bot.last_seen > OFFLINE_THRESHOLD_MS) {
    return 'offline';
  }
  return bot.status || 'offline';
};

export const buildProjectStats = (bots: Bot[], currentTime: number): ProjectStats => {
  const stats: ProjectStats = {
    total: bots.length,
    active: 0,
    prepare: 0,
    offline: 0,
    banned: 0,
  };

  bots.forEach((bot) => {
    const status = computeBotStatus(bot, currentTime);
    if (status === 'banned') stats.banned += 1;
    else if (status === 'offline') stats.offline += 1;
    else if (status === 'prepare') stats.prepare += 1;
    else stats.active += 1;
  });

  return stats;
};
