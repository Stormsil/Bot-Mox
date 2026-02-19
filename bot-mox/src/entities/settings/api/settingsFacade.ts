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
import { readSettingsPath, writeSettingsPath } from './settingsPathClient';
import { getThemeSettings, type ThemeSettings } from './themeFacade';

const SETTINGS_ALERTS_PATH = 'alerts';
const SETTINGS_PROJECTS_PATH = 'projects';
const SETTINGS_STORAGE_POLICY_PATH = 'storage_policy';

const DEFAULT_PROJECTS: Record<string, ProjectSettings> = {
  wow_tbc: {
    id: 'wow_tbc',
    name: 'WoW TBC',
    game: 'World of Warcraft',
    expansion: 'The Burning Crusade',
    max_level: 70,
    currency: 'gold',
    currency_symbol: 'g',
    server_region: 'Europe',
    professions: [],
  },
  wow_midnight: {
    id: 'wow_midnight',
    name: 'WoW Midnight',
    game: 'World of Warcraft',
    expansion: 'Midnight',
    max_level: 80,
    currency: 'gold',
    currency_symbol: 'g',
    server_region: 'Europe',
    professions: [],
  },
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const normalizeApiKeys = (value: unknown): ApiKeys => {
  const source = asRecord(value);
  const ipqs = asRecord(source.ipqs);
  const telegram = asRecord(source.telegram);

  return {
    ipqs: {
      api_key: typeof ipqs.api_key === 'string' ? ipqs.api_key : '',
      enabled: Boolean(ipqs.enabled),
    },
    telegram: {
      bot_token: typeof telegram.bot_token === 'string' ? telegram.bot_token : '',
      chat_id: typeof telegram.chat_id === 'string' ? telegram.chat_id : '',
      enabled: Boolean(telegram.enabled),
    },
  };
};

const normalizeProxySettings = (value: unknown): ProxySettings => {
  const source = asRecord(value);
  return {
    auto_check_on_add:
      typeof source.auto_check_on_add === 'boolean' ? source.auto_check_on_add : true,
    fraud_score_threshold:
      typeof source.fraud_score_threshold === 'number' ? source.fraud_score_threshold : 75,
    check_interval_hours:
      typeof source.check_interval_hours === 'number' ? source.check_interval_hours : 0,
  };
};

const normalizeNotificationEvents = (value: unknown): NotificationEvents => {
  const source = asRecord(value);
  return {
    bot_banned: typeof source.bot_banned === 'boolean' ? source.bot_banned : true,
    bot_offline: typeof source.bot_offline === 'boolean' ? source.bot_offline : true,
    bot_online: typeof source.bot_online === 'boolean' ? source.bot_online : false,
    level_up: typeof source.level_up === 'boolean' ? source.level_up : true,
    profession_maxed:
      typeof source.profession_maxed === 'boolean' ? source.profession_maxed : false,
    low_fraud_score: typeof source.low_fraud_score === 'boolean' ? source.low_fraud_score : true,
    daily_report: typeof source.daily_report === 'boolean' ? source.daily_report : false,
  };
};

const normalizeProjects = (raw: unknown): Record<string, ProjectSettings> => {
  if (!raw || typeof raw !== 'object') {
    return DEFAULT_PROJECTS;
  }

  const source = raw as Record<string, unknown>;
  const normalized: Record<string, ProjectSettings> = {};

  for (const [projectId, value] of Object.entries(source)) {
    const item = (value ?? {}) as Record<string, unknown>;
    normalized[projectId] = {
      id: typeof item.id === 'string' ? item.id : projectId,
      name: typeof item.name === 'string' && item.name.trim() ? item.name : projectId,
      game: typeof item.game === 'string' ? item.game : undefined,
      expansion: typeof item.expansion === 'string' ? item.expansion : undefined,
      max_level: typeof item.max_level === 'number' ? item.max_level : undefined,
      currency: typeof item.currency === 'string' ? item.currency : undefined,
      currency_symbol: typeof item.currency_symbol === 'string' ? item.currency_symbol : undefined,
      server_region: typeof item.server_region === 'string' ? item.server_region : undefined,
      professions: Array.isArray(item.professions)
        ? item.professions.filter((entry): entry is string => typeof entry === 'string')
        : undefined,
      referenceData: item.referenceData,
      created_at: typeof item.created_at === 'number' ? item.created_at : undefined,
      updated_at: typeof item.updated_at === 'number' ? item.updated_at : undefined,
      ...item,
    };
  }

  return Object.keys(normalized).length > 0 ? normalized : DEFAULT_PROJECTS;
};

function normalizeSubscriptionSettings(raw: unknown): SubscriptionSettings {
  if (!raw || typeof raw !== 'object') {
    return getDefaultSettings();
  }

  const source = raw as Record<string, unknown>;

  return {
    warning_days:
      typeof source.warning_days === 'number' && Number.isFinite(source.warning_days)
        ? source.warning_days
        : getDefaultSettings().warning_days,
    updated_at:
      typeof source.updated_at === 'number' && Number.isFinite(source.updated_at)
        ? source.updated_at
        : Date.now(),
    updated_by: typeof source.updated_by === 'string' ? source.updated_by : undefined,
  };
}

function normalizeStoragePolicy(raw: unknown): StoragePolicy {
  if (!raw || typeof raw !== 'object') {
    return getDefaultStoragePolicy();
  }

  const source = raw as Record<string, unknown>;
  const operationalRaw = String(source.operational || '')
    .trim()
    .toLowerCase();
  const syncRaw =
    source.sync && typeof source.sync === 'object' ? (source.sync as Record<string, unknown>) : {};

  return {
    secrets: 'local-only',
    operational: operationalRaw === 'local' ? 'local' : 'cloud',
    sync: {
      enabled: Boolean(syncRaw.enabled),
    },
    updated_at:
      typeof source.updated_at === 'number' && Number.isFinite(source.updated_at)
        ? source.updated_at
        : Date.now(),
    updated_by:
      typeof source.updated_by === 'string' && source.updated_by.trim()
        ? source.updated_by.trim()
        : undefined,
  };
}

function getDefaultApiKeys(): ApiKeys {
  return {
    ipqs: {
      api_key: '',
      enabled: false,
    },
    telegram: {
      bot_token: '',
      chat_id: '',
      enabled: false,
    },
  };
}

function getDefaultProxySettings(): ProxySettings {
  return {
    auto_check_on_add: true,
    fraud_score_threshold: 75,
    check_interval_hours: 0,
  };
}

function getDefaultNotificationEvents(): NotificationEvents {
  return {
    bot_banned: true,
    bot_offline: true,
    bot_online: false,
    level_up: true,
    profession_maxed: false,
    low_fraud_score: true,
    daily_report: false,
  };
}

function getDefaultStoragePolicy(): StoragePolicy {
  return {
    secrets: 'local-only',
    operational: 'cloud',
    sync: {
      enabled: false,
    },
    updated_at: Date.now(),
  };
}

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

export function getDefaultSettings(): SubscriptionSettings {
  return {
    warning_days: 7,
    updated_at: Date.now(),
  };
}

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
