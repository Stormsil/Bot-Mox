import type { Bot } from '../../../types';

export interface BotRecord extends Bot {
  vm?: {
    name?: string;
  };
  [key: string]: unknown;
  id: string;
}
