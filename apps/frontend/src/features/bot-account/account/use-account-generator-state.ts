import { message } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { popularEmailDomains } from '../../../utils/accountGenerators';
import {
  accountGeneratorPaths,
  loadCompatTemplateSnapshot,
  patchSettingsPath,
  readSettingsPath,
  templatesArrayToMap,
  templatesMapToArray,
  writeSettingsPath,
} from './settings-storage';
import type { AccountGeneratorSettings, AccountGeneratorTemplate } from './types';
import { DEFAULT_ACCOUNT_PASSWORD_OPTIONS } from './types';

interface AccountGeneratorState {
  passwordOptions: AccountGeneratorSettings['passwordOptions'];
  setPasswordOptions: React.Dispatch<
    React.SetStateAction<AccountGeneratorSettings['passwordOptions']>
  >;
  selectedDomain: string;
  setSelectedDomain: React.Dispatch<React.SetStateAction<string>>;
  customDomain: string;
  setCustomDomain: React.Dispatch<React.SetStateAction<string>>;
  useCustomDomain: boolean;
  setUseCustomDomain: React.Dispatch<React.SetStateAction<boolean>>;
  templates: AccountGeneratorTemplate[];
  templateName: string;
  setTemplateName: React.Dispatch<React.SetStateAction<string>>;
  selectedTemplateId: string;
  setSelectedTemplateId: React.Dispatch<React.SetStateAction<string>>;
  defaultTemplateId: string | null;
  lastUsedSettings: AccountGeneratorSettings | null;
  templateStorageReady: boolean;
  presetsCollapsed: boolean;
  setPresetsCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  currentGeneratorSettings: AccountGeneratorSettings;
  applyGeneratorSettings: (settings: AccountGeneratorSettings) => void;
  handleTemplateSelect: (value: string) => void;
  handleSaveTemplate: () => Promise<void>;
  handleDeleteTemplate: () => Promise<void>;
  handleSetDefaultTemplate: () => Promise<void>;
}

export const useAccountGeneratorState = (): AccountGeneratorState => {
  const [passwordOptions, setPasswordOptions] = useState(DEFAULT_ACCOUNT_PASSWORD_OPTIONS);
  const [selectedDomain, setSelectedDomain] = useState<string>(
    popularEmailDomains[0] || 'gmail.com',
  );
  const [customDomain, setCustomDomain] = useState<string>('');
  const [useCustomDomain, setUseCustomDomain] = useState(false);

  const [templates, setTemplates] = useState<AccountGeneratorTemplate[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('last');
  const [defaultTemplateId, setDefaultTemplateId] = useState<string | null>(null);
  const [lastUsedSettings, setLastUsedSettings] = useState<AccountGeneratorSettings | null>(null);
  const [templateStorageReady, setTemplateStorageReady] = useState(false);
  const [presetsCollapsed, setPresetsCollapsed] = useState(false);

  const applyGeneratorSettings = useCallback((settings: AccountGeneratorSettings) => {
    const safePasswordOptions = {
      length: settings.passwordOptions?.length ?? DEFAULT_ACCOUNT_PASSWORD_OPTIONS.length,
      uppercase: settings.passwordOptions?.uppercase ?? DEFAULT_ACCOUNT_PASSWORD_OPTIONS.uppercase,
      lowercase: settings.passwordOptions?.lowercase ?? DEFAULT_ACCOUNT_PASSWORD_OPTIONS.lowercase,
      numbers: settings.passwordOptions?.numbers ?? DEFAULT_ACCOUNT_PASSWORD_OPTIONS.numbers,
      symbols: settings.passwordOptions?.symbols ?? DEFAULT_ACCOUNT_PASSWORD_OPTIONS.symbols,
    };

    setPasswordOptions(safePasswordOptions);

    const hasValidDomain = popularEmailDomains.includes(settings.selectedDomain);
    const normalizedDomain = hasValidDomain
      ? settings.selectedDomain
      : popularEmailDomains[0] || 'gmail.com';
    setUseCustomDomain(Boolean(settings.useCustomDomain));
    setCustomDomain(settings.customDomain || '');
    setSelectedDomain(settings.useCustomDomain ? 'custom' : normalizedDomain);
  }, []);

  useEffect(() => {
    let active = true;

    const loadTemplateStorage = async () => {
      try {
        const [templatesData, defaultTemplateData, lastSettingsData] = await Promise.all([
          readSettingsPath<Record<string, Omit<AccountGeneratorTemplate, 'id'>>>(
            accountGeneratorPaths.templates,
          ),
          readSettingsPath<string>(accountGeneratorPaths.defaultTemplate),
          readSettingsPath<AccountGeneratorSettings>(accountGeneratorPaths.lastSettings),
        ]);

        let loadedTemplates = templatesMapToArray(templatesData || {});
        let loadedDefaultTemplateId =
          typeof defaultTemplateData === 'string' ? defaultTemplateData : null;
        let loadedLastSettings = lastSettingsData || null;

        if (loadedTemplates.length === 0 && !loadedDefaultTemplateId && !loadedLastSettings) {
          const localSnapshot = loadCompatTemplateSnapshot();

          if (localSnapshot.templates.length > 0) {
            await writeSettingsPath(
              accountGeneratorPaths.templates,
              templatesArrayToMap(localSnapshot.templates),
            );
            loadedTemplates = localSnapshot.templates;
          }

          if (localSnapshot.defaultTemplateId) {
            await writeSettingsPath(
              accountGeneratorPaths.defaultTemplate,
              localSnapshot.defaultTemplateId,
            );
            loadedDefaultTemplateId = localSnapshot.defaultTemplateId;
          }

          if (localSnapshot.lastSettings) {
            await writeSettingsPath(accountGeneratorPaths.lastSettings, localSnapshot.lastSettings);
            loadedLastSettings = localSnapshot.lastSettings;
          }
        }

        if (!active) return;

        setTemplates(loadedTemplates);
        setDefaultTemplateId(loadedDefaultTemplateId);
        setLastUsedSettings(loadedLastSettings);

        if (loadedDefaultTemplateId) {
          const defaultTemplate = loadedTemplates.find(
            (template) => template.id === loadedDefaultTemplateId,
          );
          if (defaultTemplate) {
            applyGeneratorSettings(defaultTemplate.settings);
            setSelectedTemplateId(defaultTemplate.id);
            return;
          }
        }

        if (loadedLastSettings) {
          applyGeneratorSettings(loadedLastSettings);
        }
      } catch (error) {
        console.error('Failed to load account generator presets:', error);
      } finally {
        if (active) {
          setTemplateStorageReady(true);
        }
      }
    };

    void loadTemplateStorage();

    return () => {
      active = false;
    };
  }, [applyGeneratorSettings]);

  const currentGeneratorSettings = useMemo<AccountGeneratorSettings>(
    () => ({
      passwordOptions,
      selectedDomain,
      customDomain,
      useCustomDomain,
    }),
    [passwordOptions, selectedDomain, customDomain, useCustomDomain],
  );

  useEffect(() => {
    if (!templateStorageReady) return;
    setLastUsedSettings(currentGeneratorSettings);
    void writeSettingsPath(accountGeneratorPaths.lastSettings, currentGeneratorSettings).catch(
      (error) => {
        console.error('Failed to save last account generator settings:', error);
      },
    );
  }, [currentGeneratorSettings, templateStorageReady]);

  const handleTemplateSelect = useCallback(
    (value: string) => {
      setSelectedTemplateId(value);
      if (value === 'last') {
        if (lastUsedSettings) {
          applyGeneratorSettings(lastUsedSettings);
        }
        return;
      }

      const template = templates.find((item) => item.id === value);
      if (template) {
        applyGeneratorSettings(template.settings);
        message.success(`Template "${template.name}" loaded`);
      }
    },
    [applyGeneratorSettings, lastUsedSettings, templates],
  );

  const handleSaveTemplate = useCallback(async () => {
    const name = templateName.trim();
    if (!name) {
      message.warning('Please enter template name');
      return;
    }

    try {
      const templateId = `account_tpl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const newTemplate: AccountGeneratorTemplate = {
        id: templateId,
        name,
        created_at: Date.now(),
        settings: currentGeneratorSettings,
      };

      await writeSettingsPath(`${accountGeneratorPaths.templates}/${templateId}`, {
        name: newTemplate.name,
        created_at: newTemplate.created_at,
        settings: newTemplate.settings,
      });

      setTemplates((prev) => [...prev, newTemplate]);
      setTemplateName('');
      setSelectedTemplateId(newTemplate.id);
      message.success('Template saved');
    } catch (error) {
      console.error('Failed to save account template:', error);
      message.error('Failed to save template');
    }
  }, [currentGeneratorSettings, templateName]);

  const handleDeleteTemplate = useCallback(async () => {
    if (selectedTemplateId === 'last') return;

    try {
      await patchSettingsPath(accountGeneratorPaths.templates, {
        [selectedTemplateId]: null,
      });

      setTemplates((prev) => prev.filter((item) => item.id !== selectedTemplateId));

      if (defaultTemplateId === selectedTemplateId) {
        setDefaultTemplateId(null);
        await writeSettingsPath(accountGeneratorPaths.defaultTemplate, null);
      }

      setSelectedTemplateId('last');
      message.success('Template deleted');
    } catch (error) {
      console.error('Failed to delete account template:', error);
      message.error('Failed to delete template');
    }
  }, [defaultTemplateId, selectedTemplateId]);

  const handleSetDefaultTemplate = useCallback(async () => {
    if (selectedTemplateId === 'last') {
      message.warning('Select a template first');
      return;
    }

    try {
      await writeSettingsPath(accountGeneratorPaths.defaultTemplate, selectedTemplateId);
      setDefaultTemplateId(selectedTemplateId);
      message.success('Default template set');
    } catch (error) {
      console.error('Failed to set default account template:', error);
      message.error('Failed to set default template');
    }
  }, [selectedTemplateId]);

  return {
    passwordOptions,
    setPasswordOptions,
    selectedDomain,
    setSelectedDomain,
    customDomain,
    setCustomDomain,
    useCustomDomain,
    setUseCustomDomain,
    templates,
    templateName,
    setTemplateName,
    selectedTemplateId,
    setSelectedTemplateId,
    defaultTemplateId,
    lastUsedSettings,
    templateStorageReady,
    presetsCollapsed,
    setPresetsCollapsed,
    currentGeneratorSettings,
    applyGeneratorSettings,
    handleTemplateSelect,
    handleSaveTemplate,
    handleDeleteTemplate,
    handleSetDefaultTemplate,
  };
};
