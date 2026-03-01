export interface BotsListQuery {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  q?: string;
}

export type BotLifecycleTransitionStatus =
  | 'offline'
  | 'prepare'
  | 'leveling'
  | 'profession'
  | 'farming'
  | 'banned';

export interface BotBanPayload {
  ban_date: string;
  ban_reason: string;
  ban_mechanism:
    | 'battlenet_account_closure'
    | 'battlenet_account_suspension'
    | 'game_suspension'
    | 'hardware_ban'
    | 'ip_ban'
    | 'other';
  unbanned_at?: number;
  ban_timestamp?: number;
}

export const PAGE_LIMIT = 200;
export const MAX_PAGE_COUNT = 100;
