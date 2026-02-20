import { uiLogger } from '../../../observability/uiLogger';
import {
  getApiKeysViaContract,
  getNotificationEventsViaContract,
  getProxySettingsViaContract,
  putApiKeysViaContract,
  putNotificationEventsViaContract,
  putProxySettingsViaContract,
} from '../../../providers/settings-contract-client';
import type {
  ApiKeys,
  NotificationEvents,
  ProxySettings,
  StoragePolicy,
  SubscriptionSettings,
} from '../../../types';
import type { ProjectSettings } from '../model/projectSettings';
import {
  DEFAULT_PROJECTS,
  getDefaultApiKeys,
  getDefaultNotificationEvents,
  getDefaultProxySettings,
  getDefaultSettings,
  getDefaultStoragePolicy,
  normalizeApiKeys,
  normalizeNotificationEvents,
  normalizeProjects,
  normalizeProxySettings,
  normalizeStoragePolicy,
  normalizeSubscriptionSettings,
} from './settingsFacade.normalizers';
import { readSettingsPath, writeSettingsPath } from './settingsPathClient';
import { getThemeSettings, type ThemeSettings } from './themeFacade';

const SETTINGS_ALERTS_PATH = 'alerts';
const SETTINGS_PROJECTS_PATH = 'projects';
const SETTINGS_STORAGE_POLICY_PATH = 'storage_policy';

export async function getApiKeys(): Promise<ApiKeys> {
  try {
    const response = await getApiKeysViaContract();
    return normalizeApiKeys(response.data);
  } catch (error) {
    uiLogger.error('Error loading API keys:', error);
    return getDefaultApiKeys();
  }
}

export async function updateApiKeys(apiKeys: Partial<ApiKeys>): Promise<void> {
  const currentKeys = await getApiKeys();
  const updates: ApiKeys = {
    ipqs: {
      ...currentKeys.ipqs,
      ...apiKeys.ipqs,
    },
    telegram: {
      ...currentKeys.telegram,
      ...apiKeys.telegram,
    },
  };

  await putApiKeysViaContract(updates);
}

export async function getProxySettings(): Promise<ProxySettings> {
  try {
    const response = await getProxySettingsViaContract();
    return normalizeProxySettings(response.data);
  } catch (error) {
    uiLogger.error('Error loading proxy settings:', error);
    return getDefaultProxySettings();
  }
}

export async function updateProxySettings(settings: Partial<ProxySettings>): Promise<void> {
  const currentSettings = await getProxySettings();
  const updates: ProxySettings = {
    ...currentSettings,
    ...settings,
  };

  await putProxySettingsViaContract(updates);
}

export async function getNotificationEvents(): Promise<NotificationEvents> {
  try {
    const response = await getNotificationEventsViaContract();
    return normalizeNotificationEvents(response.data);
  } catch (error) {
    uiLogger.error('Error loading notification events:', error);
    return getDefaultNotificationEvents();
  }
}

export async function updateNotificationEvents(events: Partial<NotificationEvents>): Promise<void> {
  const currentEvents = await getNotificationEvents();
  const updates: NotificationEvents = {
    ...currentEvents,
    ...events,
  };

  await putNotificationEventsViaContract(updates);
}

export async function getProjectSettings(): Promise<Record<string, ProjectSettings>> {
  try {
    const data = await readSettingsPath<unknown>(SETTINGS_PROJECTS_PATH);
    return normalizeProjects(data);
  } catch (error) {
    uiLogger.error('Error loading project settings:', error);
    return DEFAULT_PROJECTS;
  }
}

export { getDefaultSettings };

export async function getSubscriptionSettings(): Promise<SubscriptionSettings> {
  try {
    const data = await readSettingsPath<unknown>(SETTINGS_ALERTS_PATH);
    return normalizeSubscriptionSettings(data);
  } catch (error) {
    uiLogger.error('Error loading subscription settings:', error);
    return getDefaultSettings();
  }
}

export async function updateSubscriptionSettings(
  settings: Partial<SubscriptionSettings>,
  userId?: string,
): Promise<void> {
  const updates: SubscriptionSettings = {
    ...getDefaultSettings(),
    ...settings,
    updated_at: Date.now(),
  };

  if (userId) {
    updates.updated_by = userId;
  }

  await writeSettingsPath(SETTINGS_ALERTS_PATH, updates);
}

export async function getStoragePolicy(): Promise<StoragePolicy> {
  try {
    const data = await readSettingsPath<unknown>(SETTINGS_STORAGE_POLICY_PATH);
    return normalizeStoragePolicy(data);
  } catch (error) {
    uiLogger.error('Error loading storage policy:', error);
    return getDefaultStoragePolicy();
  }
}

export async function updateStoragePolicy(policy: Partial<StoragePolicy>): Promise<void> {
  const current = await getStoragePolicy();
  const merged: StoragePolicy = {
    ...current,
    ...policy,
    secrets: 'local-only',
    sync: {
      ...current.sync,
      ...(policy.sync || {}),
    },
    updated_at: Date.now(),
  };

  await writeSettingsPath(SETTINGS_STORAGE_POLICY_PATH, merged);
}

export { getThemeSettings };

export type {
  ApiKeys,
  NotificationEvents,
  ProjectSettings,
  ProxySettings,
  StoragePolicy,
  SubscriptionSettings,
  ThemeSettings,
};
