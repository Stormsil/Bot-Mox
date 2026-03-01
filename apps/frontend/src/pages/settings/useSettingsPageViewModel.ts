import type { FormInstance } from 'antd';
import { Form } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ProjectSettings } from '../../entities/settings/api/settingsFacade';
import { useProjectSettingsQuery } from '../../entities/settings/api/useProjectSettingsQuery';
import {
  useUpdateApiKeysMutation,
  useUpdateNotificationEventsMutation,
  useUpdateProxySettingsMutation,
  useUpdateStoragePolicyMutation,
} from '../../entities/settings/api/useSettingsMutations';
import {
  useApiKeysQuery,
  useNotificationEventsQuery,
  useProxySettingsQuery,
  useStoragePolicyQuery,
  useThemeSettingsQuery,
} from '../../entities/settings/api/useSettingsQueries';
import { useUpdateSubscriptionSettingsMutation } from '../../entities/settings/api/useSubscriptionSettingsMutation';
import { useSubscriptionSettingsQuery } from '../../entities/settings/api/useSubscriptionSettingsQuery';
import { uiLogger } from '../../observability/uiLogger';
import type {
  ApiKeysFormValues,
  NotificationEventsFormValues,
  ProxySettingsFormValues,
  StoragePolicyFormValues,
} from './types';
import { useSettingsSaveHandlers } from './useSettingsSaveHandlers';

export interface SettingsPageForms {
  apiKeysForm: FormInstance<ApiKeysFormValues>;
  proxyForm: FormInstance<ProxySettingsFormValues>;
  notificationsForm: FormInstance<NotificationEventsFormValues>;
  alertsForm: FormInstance<{ warning_days: number }>;
  storagePolicyForm: FormInstance<StoragePolicyFormValues>;
}

export interface SettingsPageActions {
  refreshAll: () => Promise<void>;
  handleSaveApiKeys: ReturnType<typeof useSettingsSaveHandlers>['handleSaveApiKeys'];
  handleSaveProxySettings: ReturnType<typeof useSettingsSaveHandlers>['handleSaveProxySettings'];
  handleSaveNotifications: ReturnType<typeof useSettingsSaveHandlers>['handleSaveNotifications'];
  handleSaveGlobalAlerts: ReturnType<typeof useSettingsSaveHandlers>['handleSaveGlobalAlerts'];
  handleSaveStoragePolicy: ReturnType<typeof useSettingsSaveHandlers>['handleSaveStoragePolicy'];
}

export interface SettingsPageViewModel {
  forms: SettingsPageForms;
  ui: {
    loading: boolean;
    saving: boolean;
  };
  data: {
    projectEntries: Array<[string, ProjectSettings]>;
    themeSettingsQueryData: ReturnType<typeof useThemeSettingsQuery>['data'];
  };
  actions: SettingsPageActions;
}

export function useSettingsPageViewModel(): SettingsPageViewModel {
  const [saving, setSaving] = useState(false);
  const [apiKeysForm] = Form.useForm<ApiKeysFormValues>();
  const [proxyForm] = Form.useForm<ProxySettingsFormValues>();
  const [notificationsForm] = Form.useForm<NotificationEventsFormValues>();
  const [alertsForm] = Form.useForm<{ warning_days: number }>();
  const [storagePolicyForm] = Form.useForm<StoragePolicyFormValues>();

  const apiKeysQuery = useApiKeysQuery();
  const proxySettingsQuery = useProxySettingsQuery();
  const notificationEventsQuery = useNotificationEventsQuery();
  const themeSettingsQuery = useThemeSettingsQuery();
  const projectSettingsQuery = useProjectSettingsQuery();
  const storagePolicyQuery = useStoragePolicyQuery();
  const subscriptionSettingsQuery = useSubscriptionSettingsQuery();

  const updateApiKeysMutation = useUpdateApiKeysMutation();
  const updateProxySettingsMutation = useUpdateProxySettingsMutation();
  const updateNotificationEventsMutation = useUpdateNotificationEventsMutation();
  const updateSubscriptionSettingsMutation = useUpdateSubscriptionSettingsMutation();
  const updateStoragePolicyMutation = useUpdateStoragePolicyMutation();

  useEffect(() => {
    if (!apiKeysQuery.data) return;
    apiKeysForm.setFieldsValue({
      ipqs_api_key: apiKeysQuery.data.ipqs.api_key,
      ipqs_enabled: apiKeysQuery.data.ipqs.enabled,
      telegram_bot_token: apiKeysQuery.data.telegram.bot_token,
      telegram_chat_id: apiKeysQuery.data.telegram.chat_id,
      telegram_enabled: apiKeysQuery.data.telegram.enabled,
    });
  }, [apiKeysForm, apiKeysQuery.data]);

  useEffect(() => {
    if (!proxySettingsQuery.data) return;
    proxyForm.setFieldsValue({
      auto_check_on_add: proxySettingsQuery.data.auto_check_on_add,
      fraud_score_threshold: proxySettingsQuery.data.fraud_score_threshold,
      check_interval_hours: proxySettingsQuery.data.check_interval_hours,
    });
  }, [proxyForm, proxySettingsQuery.data]);

  useEffect(() => {
    if (!notificationEventsQuery.data) return;
    notificationsForm.setFieldsValue(notificationEventsQuery.data);
  }, [notificationEventsQuery.data, notificationsForm]);

  useEffect(() => {
    if (!storagePolicyQuery.data) return;
    storagePolicyForm.setFieldsValue({
      operational: storagePolicyQuery.data.operational,
      sync_enabled: Boolean(storagePolicyQuery.data.sync?.enabled),
    });
  }, [storagePolicyForm, storagePolicyQuery.data]);

  useEffect(() => {
    if (!subscriptionSettingsQuery.data) {
      return;
    }

    alertsForm.setFieldsValue({
      warning_days: subscriptionSettingsQuery.data.warning_days,
    });
  }, [alertsForm, subscriptionSettingsQuery.data]);

  useEffect(() => {
    if (apiKeysQuery.error) uiLogger.error('Error loading API keys:', apiKeysQuery.error);
    if (proxySettingsQuery.error)
      uiLogger.error('Error loading proxy settings:', proxySettingsQuery.error);
    if (notificationEventsQuery.error)
      uiLogger.error('Error loading notification settings:', notificationEventsQuery.error);
    if (themeSettingsQuery.error)
      uiLogger.error('Error loading theme settings:', themeSettingsQuery.error);
    if (projectSettingsQuery.error)
      uiLogger.error('Error loading project settings:', projectSettingsQuery.error);
    if (storagePolicyQuery.error)
      uiLogger.error('Error loading storage policy:', storagePolicyQuery.error);
    if (subscriptionSettingsQuery.error) {
      uiLogger.error('Error loading subscription settings:', subscriptionSettingsQuery.error);
    }
  }, [
    apiKeysQuery.error,
    notificationEventsQuery.error,
    projectSettingsQuery.error,
    proxySettingsQuery.error,
    storagePolicyQuery.error,
    subscriptionSettingsQuery.error,
    themeSettingsQuery.error,
  ]);

  const loading =
    apiKeysQuery.isLoading ||
    proxySettingsQuery.isLoading ||
    notificationEventsQuery.isLoading ||
    themeSettingsQuery.isLoading ||
    projectSettingsQuery.isLoading ||
    storagePolicyQuery.isLoading ||
    subscriptionSettingsQuery.isLoading ||
    apiKeysQuery.isFetching ||
    proxySettingsQuery.isFetching ||
    notificationEventsQuery.isFetching ||
    themeSettingsQuery.isFetching ||
    projectSettingsQuery.isFetching ||
    storagePolicyQuery.isFetching ||
    subscriptionSettingsQuery.isFetching;

  const {
    handleSaveApiKeys,
    handleSaveProxySettings,
    handleSaveNotifications,
    handleSaveGlobalAlerts,
    handleSaveStoragePolicy,
  } = useSettingsSaveHandlers({
    setSaving,
    saveApiKeys: updateApiKeysMutation.mutateAsync,
    saveProxySettings: updateProxySettingsMutation.mutateAsync,
    saveNotificationEvents: updateNotificationEventsMutation.mutateAsync,
    saveSubscriptionSettings: updateSubscriptionSettingsMutation.mutateAsync,
    saveStoragePolicy: updateStoragePolicyMutation.mutateAsync,
    currentSubscriptionSettings: subscriptionSettingsQuery.data,
  });

  const projectEntries = useMemo(() => {
    const projects: Record<string, ProjectSettings> = projectSettingsQuery.data || {};
    return Object.entries(projects).sort((a, b) => {
      const aName = (a[1].name || a[0]).trim();
      const bName = (b[1].name || b[0]).trim();
      return aName.localeCompare(bName);
    });
  }, [projectSettingsQuery.data]);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      apiKeysQuery.refetch(),
      proxySettingsQuery.refetch(),
      notificationEventsQuery.refetch(),
      themeSettingsQuery.refetch(),
      projectSettingsQuery.refetch(),
      storagePolicyQuery.refetch(),
      subscriptionSettingsQuery.refetch(),
    ]);
  }, [
    apiKeysQuery,
    notificationEventsQuery,
    projectSettingsQuery,
    proxySettingsQuery,
    storagePolicyQuery,
    subscriptionSettingsQuery,
    themeSettingsQuery,
  ]);

  return {
    forms: {
      apiKeysForm,
      proxyForm,
      notificationsForm,
      alertsForm,
      storagePolicyForm,
    },
    ui: {
      loading,
      saving,
    },
    data: {
      projectEntries,
      themeSettingsQueryData: themeSettingsQuery.data,
    },
    actions: {
      refreshAll,
      handleSaveApiKeys,
      handleSaveProxySettings,
      handleSaveNotifications,
      handleSaveGlobalAlerts,
      handleSaveStoragePolicy,
    },
  };
}
