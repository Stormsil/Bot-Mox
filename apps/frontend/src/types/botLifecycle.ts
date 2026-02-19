import type { BotStatus, Character } from './core';

// ============================================
// Bot Lifecycle Types - Типы для жизненного цикла ботов
// ============================================

export type BotLifecycleStage = 'prepare' | 'leveling' | 'profession' | 'farming';

export type BanMechanism =
  | 'battlenet_account_closure'
  | 'battlenet_account_suspension'
  | 'game_suspension'
  | 'hardware_ban'
  | 'ip_ban'
  | 'other';

export interface BanDetails {
  ban_date: string; // Формат DD.MM.YYYY
  ban_reason: string;
  ban_mechanism: BanMechanism;
  unbanned_at?: number;
}

export interface BotLifecycle {
  current_stage: BotLifecycleStage | 'banned';
  previous_status?: BotStatus;
  stage_transitions: {
    from: BotLifecycleStage | 'create';
    to: BotLifecycleStage;
    timestamp: number;
  }[];
  ban_details?: BanDetails;
}

export interface ArchiveEntry {
  bot_id: string;
  archived_at: number;
  reason: 'banned' | 'manual_stop' | 'error' | 'migrated';
  ban_details?: BanDetails;
  snapshot: {
    project_id: string;
    character: Character;
    final_level: number;
    total_farmed: number;
    total_earned_gold: number;
    total_runtime_hours: number;
  };
}
