import {
  getSettingsPath,
  patchSettingsPath,
  readSettingsPath,
  writeSettingsPath,
} from '../../../entities/settings/api/settingsPathClient';
import { popularEmailDomains } from '../../../utils/accountGenerators';
import type { AccountGeneratorSettings, AccountGeneratorTemplate } from './types';
import {
  ACCOUNT_DEFAULT_TEMPLATE_MIGRATION_KEY,
  ACCOUNT_DEFAULT_TEMPLATE_PATH,
  ACCOUNT_LAST_SETTINGS_PATH,
  ACCOUNT_SETTINGS_MIGRATION_KEY,
  ACCOUNT_TEMPLATES_MIGRATION_KEY,
  ACCOUNT_TEMPLATES_PATH,
  DEFAULT_ACCOUNT_PASSWORD_OPTIONS,
} from './types';

export const accountGeneratorPaths = {
  lastSettings: ACCOUNT_LAST_SETTINGS_PATH,
  templates: ACCOUNT_TEMPLATES_PATH,
  defaultTemplate: ACCOUNT_DEFAULT_TEMPLATE_PATH,
};

export { getSettingsPath, patchSettingsPath, readSettingsPath, writeSettingsPath };

export const loadFromLocalStorage = <T>(key: string): T | null => {
  try {
    const data = localStorage.getItem(key);
    return data ? (JSON.parse(data) as T) : null;
  } catch (error) {
    console.error(`Failed to load "${key}" from localStorage:`, error);
    return null;
  }
};

export const loadLegacyDefaultTemplateId = (): string | null => {
  try {
    return localStorage.getItem(ACCOUNT_DEFAULT_TEMPLATE_MIGRATION_KEY);
  } catch (error) {
    console.error('Failed to load default account template from localStorage:', error);
    return null;
  }
};

export const loadLegacyTemplateSnapshot = () => ({
  templates:
    loadFromLocalStorage<AccountGeneratorTemplate[]>(ACCOUNT_TEMPLATES_MIGRATION_KEY) || [],
  defaultTemplateId: loadLegacyDefaultTemplateId(),
  lastSettings: loadFromLocalStorage<AccountGeneratorSettings>(ACCOUNT_SETTINGS_MIGRATION_KEY),
});

export const templatesArrayToMap = (
  templates: AccountGeneratorTemplate[],
): Record<string, Omit<AccountGeneratorTemplate, 'id'>> => {
  return templates.reduce<Record<string, Omit<AccountGeneratorTemplate, 'id'>>>((acc, template) => {
    acc[template.id] = {
      name: template.name,
      created_at: template.created_at,
      settings: template.settings,
    };
    return acc;
  }, {});
};

export const templatesMapToArray = (data: unknown): AccountGeneratorTemplate[] => {
  if (!data || typeof data !== 'object') {
    return [];
  }

  return Object.entries(data as Record<string, Omit<AccountGeneratorTemplate, 'id'>>)
    .map(([id, template]) => ({
      id,
      name: template?.name || 'Unnamed template',
      created_at: template?.created_at || Date.now(),
      settings: template?.settings || {
        passwordOptions: DEFAULT_ACCOUNT_PASSWORD_OPTIONS,
        selectedDomain: popularEmailDomains[0] || 'gmail.com',
        customDomain: '',
        useCustomDomain: false,
      },
    }))
    .sort((a, b) => a.created_at - b.created_at);
};
