import type { VMGeneratorSettings } from '../../../types';
import type { SecretBindingsMap } from '../../../types/secrets';

export type TemplateSyncState = 'idle' | 'loading' | 'ok' | 'error';

export type SettingsFieldUpdater = (path: string, value: unknown) => void;

export interface SettingsSectionProps {
  settings: VMGeneratorSettings;
  onFieldChange: SettingsFieldUpdater;
  secretBindings?: SecretBindingsMap;
  onSecretBindingChange?: (fieldName: string, binding: import('../../../types/secrets').SecretBinding) => void;
}
