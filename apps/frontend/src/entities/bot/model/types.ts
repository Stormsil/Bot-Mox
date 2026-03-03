import type { Bot } from '../../../shared/types';

export interface BotRecord extends Bot {
  computed_status: Bot['status'];
  days_remaining: number | null;
  is_expiring_soon: boolean;
  vm?: {
    name?: string;
  };
  [key: string]: unknown;
  id: string;
}
