import type { VMGeneratorSettings } from '../../../shared/types';
import type { SecretBindingsMap } from '../../../shared/types/secrets';

export type TemplateSyncState = 'idle' | 'loading' | 'ok' | 'error';

export type SettingsFieldUpdater = (path: string, value: unknown) => void;

export interface TemplateVmSummary {
  node: string;
  vmId: number;
  cores?: number | null;
  memoryMb?: number | null;
  diskBytes?: number | null;
  display?: string | null;
}

export interface SettingsSectionProps {
  settings: VMGeneratorSettings;
  onFieldChange: SettingsFieldUpdater;
  secretBindings?: SecretBindingsMap;
  onSecretBindingChange?: (
    fieldName: string,
    binding: import('../../../shared/types/secrets').SecretBinding,
  ) => void;
}
