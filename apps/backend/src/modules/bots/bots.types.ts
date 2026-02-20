export type BotRecord = Record<string, unknown>;
export type BotStatus = 'offline' | 'prepare' | 'leveling' | 'profession' | 'farming' | 'banned';
export type BotLifecycleStage = 'prepare' | 'leveling' | 'profession' | 'farming' | 'banned';

export interface BotLifecycleTransition {
  from: 'prepare' | 'leveling' | 'profession' | 'farming' | 'create';
  to: 'prepare' | 'leveling' | 'profession' | 'farming';
  timestamp: number;
}

export interface BotLifecycleState {
  current_stage: BotLifecycleStage;
  previous_status?: BotStatus;
  stage_transitions: BotLifecycleTransition[];
  ban_details?: Record<string, unknown>;
}

export interface BotsListQuery {
  page?: number | undefined;
  limit?: number | undefined;
  sort?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
  q?: string | undefined;
}

export interface BotsListResult {
  items: BotRecord[];
  total: number;
  page: number;
  limit: number;
}

export const BOT_STATUS_TO_STAGE: Record<
  string,
  'prepare' | 'leveling' | 'profession' | 'farming' | null
> = {
  offline: null,
  prepare: 'prepare',
  leveling: 'leveling',
  profession: 'profession',
  farming: 'farming',
  banned: null,
};

export const RESTORABLE_STATUSES = new Set([
  'offline',
  'prepare',
  'leveling',
  'profession',
  'farming',
]);
