export interface ApiKeysFormValues {
  ipqs_api_key?: string;
  ipqs_enabled?: boolean;
  telegram_bot_token?: string;
  telegram_chat_id?: string;
  telegram_enabled?: boolean;
}

export interface ProxySettingsFormValues {
  auto_check_on_add?: boolean;
  fraud_score_threshold?: number;
  check_interval_hours?: number;
}

export interface NotificationEventsFormValues {
  bot_banned?: boolean;
  bot_offline?: boolean;
  bot_online?: boolean;
  level_up?: boolean;
  profession_maxed?: boolean;
  low_fraud_score?: boolean;
  daily_report?: boolean;
}

export interface StoragePolicyFormValues {
  operational?: 'local' | 'cloud';
  sync_enabled?: boolean;
}
