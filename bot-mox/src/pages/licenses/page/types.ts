import type { Dayjs } from 'dayjs';
import type { LicenseWithBots } from '../../../types';
import type { BotRecord } from '../../../services/botsApiService';

export interface LicenseFormValues {
  key: string;
  type: string;
  expires_at: Dayjs;
}

export interface AddBotFormValues {
  bot_id: string;
}

export interface LicensesStats {
  total: number;
  active: number;
  expired: number;
  expiringSoon: number;
  unassigned: number;
}

export interface LicenseColumnsHandlers {
  onEdit: (license: LicenseWithBots) => void;
  onCopyKey: (key: string) => void;
  onDelete: (license: LicenseWithBots) => Promise<void>;
  onAddBot: (license: LicenseWithBots) => void;
  onRemoveBot: (license: LicenseWithBots, botIndex: number) => Promise<void>;
}

export type BotsMap = Record<string, BotRecord>;
