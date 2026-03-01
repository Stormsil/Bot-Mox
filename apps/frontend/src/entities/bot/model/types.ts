import type { Bot } from '../../../shared/types';

export interface BotRecord extends Bot {
  vm?: {
    name?: string;
  };
  [key: string]: unknown;
  id: string;
}
