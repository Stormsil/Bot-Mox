import type { Dayjs } from 'dayjs';
import type { Bot } from '../../../types';
import type { BotLicense } from '../../../entities/resources/model/types';

export interface BotLicenseProps {
  bot: Bot;
}

export interface LicenseInfo extends BotLicense {
  daysRemaining?: number;
  isExpired?: boolean;
  isExpiringSoon?: boolean;
}

export interface LicenseFormValues {
  key: string;
  type: string;
  expires_at: Dayjs;
}

export interface AssignLicenseFormValues {
  license_id: string;
}
