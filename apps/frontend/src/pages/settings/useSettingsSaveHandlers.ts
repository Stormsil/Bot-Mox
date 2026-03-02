import { useCallback } from 'react';
import type { SubscriptionSettings } from '../../entities/resources/model/types';
import { getDefaultSettings } from '../../entities/settings/api/settingsFacade';
import type {
  ApiKeys,
  NotificationEvents,
  ProxySettings,
} from '../../entities/settings/model/types';
import type {
  ApiKeysFormValues,
  NotificationEventsFormValues,
  ProxySettingsFormValues,
  StoragePolicyFormValues,
} from './types';

interface UseSettingsSaveHandlersOptions {
  saveApiKeys: (value: ApiKeys) => void;
  saveProxySettings: (value: ProxySettings) => void;
  saveNotificationEvents: (value: NotificationEvents) => void;
  saveSubscriptionSettings: (value: Partial<SubscriptionSettings>) => void;
  saveStoragePolicy: (value: {
    secrets: 'local-only';
    operational: 'local' | 'cloud';
    sync: { enabled: boolean };
  }) => void;
  currentSubscriptionSettings: SubscriptionSettings | null | undefined;
}

interface SettingsSaveHandlers {
  handleSaveApiKeys: (values: ApiKeysFormValues) => Promise<void>;
  handleSaveProxySettings: (values: ProxySettingsFormValues) => Promise<void>;
  handleSaveNotifications: (values: NotificationEventsFormValues) => Promise<void>;
  handleSaveGlobalAlerts: (values: { warning_days: number }) => Promise<void>;
  handleSaveStoragePolicy: (values: StoragePolicyFormValues) => Promise<void>;
}

export function useSettingsSaveHandlers(
  options: UseSettingsSaveHandlersOptions,
): SettingsSaveHandlers {
  const handleSaveApiKeys = useCallback(
    async (values: ApiKeysFormValues) => {
      const newApiKeys: ApiKeys = {
        ipqs: {
          api_key: values.ipqs_api_key || '',
          enabled: Boolean(values.ipqs_enabled),
        },
        telegram: {
          bot_token: values.telegram_bot_token || '',
          chat_id: values.telegram_chat_id || '',
          enabled: Boolean(values.telegram_enabled),
        },
      };

      options.saveApiKeys(newApiKeys);
    },
    [options],
  );

  const handleSaveProxySettings = useCallback(
    async (values: ProxySettingsFormValues) => {
      const newProxySettings: ProxySettings = {
        auto_check_on_add: Boolean(values.auto_check_on_add),
        fraud_score_threshold: Number(values.fraud_score_threshold || 0),
        check_interval_hours: Number(values.check_interval_hours || 0),
      };

      options.saveProxySettings(newProxySettings);
    },
    [options],
  );

  const handleSaveNotifications = useCallback(
    async (values: NotificationEventsFormValues) => {
      const newEvents: NotificationEvents = {
        bot_banned: Boolean(values.bot_banned),
        bot_offline: Boolean(values.bot_offline),
        bot_online: Boolean(values.bot_online),
        level_up: Boolean(values.level_up),
        profession_maxed: Boolean(values.profession_maxed),
        low_fraud_score: Boolean(values.low_fraud_score),
        daily_report: Boolean(values.daily_report),
      };

      options.saveNotificationEvents(newEvents);
    },
    [options],
  );

  const handleSaveGlobalAlerts = useCallback(
    async (values: { warning_days: number }) => {
      const nextAlerts: Partial<SubscriptionSettings> = {
        ...(options.currentSubscriptionSettings || getDefaultSettings()),
        warning_days: values.warning_days,
      };
      options.saveSubscriptionSettings(nextAlerts);
    },
    [options],
  );

  const handleSaveStoragePolicy = useCallback(
    async (values: StoragePolicyFormValues) => {
      options.saveStoragePolicy({
        secrets: 'local-only',
        operational: values.operational === 'local' ? 'local' : 'cloud',
        sync: {
          enabled: Boolean(values.sync_enabled),
        },
      });
    },
    [options],
  );

  return {
    handleSaveApiKeys,
    handleSaveProxySettings,
    handleSaveNotifications,
    handleSaveGlobalAlerts,
    handleSaveStoragePolicy,
  };
}
