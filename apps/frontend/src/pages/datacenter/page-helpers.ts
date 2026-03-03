import type { Bot } from '../../shared/types';
import type { ContentMapSection, ProjectStats } from './content-map';

const OFFLINE_THRESHOLD_MS = 5 * 60 * 1000;

type BotWithComputedStatus = Bot & {
  computed_status?: Bot['status'];
};

function computeBotStatusAt(bot: BotWithComputedStatus, currentTime: number): Bot['status'] {
  if (bot.computed_status) {
    return bot.computed_status;
  }

  if (bot.status === 'banned') return 'banned';
  const lastSeen = bot.last_seen;
  if (
    typeof lastSeen === 'number' &&
    lastSeen > 0 &&
    currentTime - lastSeen > OFFLINE_THRESHOLD_MS
  ) {
    return 'offline';
  }
  return bot.status || 'offline';
}

export const FINANCE_WINDOW_DAYS = 30;
export const MS_PER_DAY = 1000 * 60 * 60 * 24;
export const CONTENT_MAP_COLLAPSE_KEY = 'contentMapCollapsedSections';

export const DEFAULT_COLLAPSED_SECTIONS: Record<ContentMapSection, boolean> = {
  projects: false,
  resources: false,
  finance_notes: false,
  expiring: false,
};

export const buildProjectStats = (
  bots: BotWithComputedStatus[],
  currentTime: number,
): ProjectStats => {
  const stats: ProjectStats = {
    total: bots.length,
    active: 0,
    prepare: 0,
    offline: 0,
    banned: 0,
  };

  bots.forEach((bot) => {
    const status = computeBotStatusAt(bot, currentTime);
    if (status === 'banned') stats.banned += 1;
    else if (status === 'offline') stats.offline += 1;
    else if (status === 'prepare') stats.prepare += 1;
    else stats.active += 1;
  });

  return stats;
};
