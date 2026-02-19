// API Keys Types
export interface IPQSApiKey {
  api_key: string;
  enabled: boolean;
}

export interface TelegramApiKey {
  bot_token: string;
  chat_id: string;
  enabled: boolean;
}

export interface ApiKeys {
  ipqs: IPQSApiKey;
  telegram: TelegramApiKey;
}

// Proxy Settings Types
export interface ProxySettings {
  auto_check_on_add: boolean;
  fraud_score_threshold: number;
  check_interval_hours: number;
}

// Notification Event Types
export interface NotificationEvents {
  bot_banned: boolean;
  bot_offline: boolean;
  bot_online: boolean;
  level_up: boolean;
  profession_maxed: boolean;
  low_fraud_score: boolean;
  daily_report: boolean;
}

// Extended Notification Settings
export interface NotificationSettings {
  telegram_bot_token?: string; // DEPRECATED
  telegram_chat_id?: string; // DEPRECATED
  alerts: {
    bot_offline_delay_minutes: number;
    low_roi_threshold: number;
    daily_report_time: string;
  };
  events: NotificationEvents;
}

// System Settings Types
export interface SystemSettings {
  app_name: string;
  theme: 'dark' | 'light';
  currency: 'USD' | 'EUR';
}

export interface OfflineDetectionSettings {
  offline_timeout_sec: number;
}

export interface DataRetentionSettings {
  logs_retention_days: number;
}

export interface ROICalculationSettings {
  include_proxy_cost: boolean;
  include_subscription_cost: boolean;
  include_session_cost: boolean;
  depreciation_days: number;
}

export interface DataExportSettings {
  auto_archive_daily: boolean;
  local_storage_key: string;
}

export interface DevelopmentSettings {
  show_example_data: boolean;
  use_mock_data: boolean;
}

export type StorageOperationalMode = 'local' | 'cloud';

export interface StoragePolicy {
  secrets: 'local-only';
  operational: StorageOperationalMode;
  sync: {
    enabled: boolean;
  };
  updated_at: number;
  updated_by?: string;
}

// Main Settings Interface
export interface AppSettings {
  system: SystemSettings;
  offline_detection: OfflineDetectionSettings;
  data_retention: DataRetentionSettings;
  api_keys: ApiKeys;
  proxy: ProxySettings;
  notifications: NotificationSettings;
  roi_calculation: ROICalculationSettings;
  data_export: DataExportSettings;
  development: DevelopmentSettings;
  storage_policy?: StoragePolicy;
}
