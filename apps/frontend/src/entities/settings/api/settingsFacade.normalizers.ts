import type {
  ApiKeys,
  NotificationEvents,
  ProxySettings,
  StoragePolicy,
  SubscriptionSettings,
} from '../../../types';
import type { ProjectSettings } from '../model/projectSettings';

export const DEFAULT_PROJECTS: Record<string, ProjectSettings> = {
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

export const normalizeApiKeys = (value: unknown): ApiKeys => {
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

export const normalizeProxySettings = (value: unknown): ProxySettings => {
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

export const normalizeNotificationEvents = (value: unknown): NotificationEvents => {
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

export const normalizeProjects = (raw: unknown): Record<string, ProjectSettings> => {
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

export function getDefaultSettings(): SubscriptionSettings {
  return {
    warning_days: 7,
    updated_at: Date.now(),
  };
}

export function normalizeSubscriptionSettings(raw: unknown): SubscriptionSettings {
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

export function getDefaultStoragePolicy(): StoragePolicy {
  return {
    secrets: 'local-only',
    operational: 'cloud',
    sync: {
      enabled: false,
    },
    updated_at: Date.now(),
  };
}

export function normalizeStoragePolicy(raw: unknown): StoragePolicy {
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

export function getDefaultApiKeys(): ApiKeys {
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

export function getDefaultProxySettings(): ProxySettings {
  return {
    auto_check_on_add: true,
    fraud_score_threshold: 75,
    check_interval_hours: 0,
  };
}

export function getDefaultNotificationEvents(): NotificationEvents {
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
