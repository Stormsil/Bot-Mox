import type { VMGeneratorSettings } from '../../../types';

export type TemplateSyncState = 'idle' | 'loading' | 'ok' | 'error';

export type SettingsFieldUpdater = (path: string, value: unknown) => void;

export interface SettingsSectionProps {
  settings: VMGeneratorSettings;
  onFieldChange: SettingsFieldUpdater;
}
