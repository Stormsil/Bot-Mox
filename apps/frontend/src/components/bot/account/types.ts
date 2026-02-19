import type { Dayjs } from 'dayjs';
import type { PasswordOptions } from '../../../utils/accountGenerators';

export interface BotWithAccount {
  id: string;
  name: string;
  account?: {
    email?: string;
    password?: string;
    bnet_created_at?: number;
    mail_created_at?: number;
  };
  person?: {
    first_name?: string;
    last_name?: string;
    birth_date?: string;
  };
  generation_locks?: {
    account_email?: boolean;
    account_password?: boolean;
  };
}

export interface BotAccountProps {
  bot: BotWithAccount;
}

export interface AccountFormValues {
  email: string;
  password: string;
  registration_date: Dayjs | null;
}

export interface AccountGeneratorSettings {
  passwordOptions: PasswordOptions;
  selectedDomain: string;
  customDomain: string;
  useCustomDomain: boolean;
}

export interface AccountGeneratorTemplate {
  id: string;
  name: string;
  created_at: number;
  settings: AccountGeneratorSettings;
}

export interface AccountGenerationLocks {
  email: boolean;
  password: boolean;
}

export interface PendingGenerationState {
  type: 'password' | 'email' | 'both';
}

export const ACCOUNT_TEMPLATE_BASE_PATH = 'settings/generators/account';
export const ACCOUNT_LAST_SETTINGS_PATH = `${ACCOUNT_TEMPLATE_BASE_PATH}/lastSettings`;
export const ACCOUNT_TEMPLATES_PATH = `${ACCOUNT_TEMPLATE_BASE_PATH}/templates`;
export const ACCOUNT_DEFAULT_TEMPLATE_PATH = `${ACCOUNT_TEMPLATE_BASE_PATH}/defaultTemplateId`;

export const ACCOUNT_SETTINGS_MIGRATION_KEY = 'botmox_account_generator_last';
export const ACCOUNT_TEMPLATES_MIGRATION_KEY = 'botmox_account_generator_templates';
export const ACCOUNT_DEFAULT_TEMPLATE_MIGRATION_KEY = 'botmox_account_generator_default';

export const DEFAULT_ACCOUNT_PASSWORD_OPTIONS: PasswordOptions = {
  length: 12,
  uppercase: true,
  lowercase: true,
  numbers: true,
  symbols: true,
};
