import { message } from 'antd';
import { useCallback } from 'react';
import { getDefaultSettings } from '../../entities/settings/api/settingsFacade';
import { uiLogger } from '../../observability/uiLogger';
import type { ApiKeys, NotificationEvents, ProxySettings, SubscriptionSettings } from '../../types';
import type {
  ApiKeysFormValues,
  NotificationEventsFormValues,
  ProxySettingsFormValues,
  StoragePolicyFormValues,
} from './types';

interface UseSettingsSaveHandlersOptions {
  setSaving: (saving: boolean) => void;
  saveApiKeys: (value: ApiKeys) => Promise<unknown>;
  saveProxySettings: (value: ProxySettings) => Promise<unknown>;
  saveNotificationEvents: (value: NotificationEvents) => Promise<unknown>;
  saveSubscriptionSettings: (value: Partial<SubscriptionSettings>) => Promise<unknown>;
  saveStoragePolicy: (value: {
    secrets: 'local-only';
    operational: 'local' | 'cloud';
    sync: { enabled: boolean };
  }) => Promise<unknown>;
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
      options.setSaving(true);
      try {
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

        await options.saveApiKeys(newApiKeys);
        message.success('API keys saved');
      } catch (error) {
        uiLogger.error('Error saving API keys:', error);
        message.error('Failed to save API keys');
      } finally {
        options.setSaving(false);
      }
    },
    [options],
  );

  const handleSaveProxySettings = useCallback(
    async (values: ProxySettingsFormValues) => {
      options.setSaving(true);
      try {
        const newProxySettings: ProxySettings = {
          auto_check_on_add: Boolean(values.auto_check_on_add),
          fraud_score_threshold: Number(values.fraud_score_threshold || 0),
          check_interval_hours: Number(values.check_interval_hours || 0),
        };

        await options.saveProxySettings(newProxySettings);
        message.success('Proxy settings saved');
      } catch (error) {
        uiLogger.error('Error saving proxy settings:', error);
        message.error('Failed to save proxy settings');
      } finally {
        options.setSaving(false);
      }
    },
    [options],
  );

  const handleSaveNotifications = useCallback(
    async (values: NotificationEventsFormValues) => {
      options.setSaving(true);
      try {
        const newEvents: NotificationEvents = {
          bot_banned: Boolean(values.bot_banned),
          bot_offline: Boolean(values.bot_offline),
          bot_online: Boolean(values.bot_online),
          level_up: Boolean(values.level_up),
          profession_maxed: Boolean(values.profession_maxed),
          low_fraud_score: Boolean(values.low_fraud_score),
          daily_report: Boolean(values.daily_report),
        };

        await options.saveNotificationEvents(newEvents);
        message.success('Notification settings saved');
      } catch (error) {
        uiLogger.error('Error saving notification settings:', error);
        message.error('Failed to save notification settings');
      } finally {
        options.setSaving(false);
      }
    },
    [options],
  );

  const handleSaveGlobalAlerts = useCallback(
    async (values: { warning_days: number }) => {
      options.setSaving(true);
      try {
        const nextAlerts: Partial<SubscriptionSettings> = {
          ...(options.currentSubscriptionSettings || getDefaultSettings()),
          warning_days: values.warning_days,
        };
        await options.saveSubscriptionSettings(nextAlerts);
        message.success('Global alert settings saved');
      } catch (error) {
        uiLogger.error('Error saving global alert settings:', error);
        message.error('Failed to save global alert settings');
      } finally {
        options.setSaving(false);
      }
    },
    [options],
  );

  const handleSaveStoragePolicy = useCallback(
    async (values: StoragePolicyFormValues) => {
      options.setSaving(true);
      try {
        await options.saveStoragePolicy({
          secrets: 'local-only',
          operational: values.operational === 'local' ? 'local' : 'cloud',
          sync: {
            enabled: Boolean(values.sync_enabled),
          },
        });
        message.success('Storage policy saved');
      } catch (error) {
        uiLogger.error('Error saving storage policy:', error);
        message.error('Failed to save storage policy');
      } finally {
        options.setSaving(false);
      }
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
