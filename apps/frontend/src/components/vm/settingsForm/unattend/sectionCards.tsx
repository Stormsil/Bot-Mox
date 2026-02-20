import type React from 'react';
import type { UnattendProfileConfig } from '../../../../entities/vm/api/unattendProfileFacade';
import { AccountSection } from './AccountSection';
import { BloatwareSection } from './BloatwareSection';
import { CustomScriptSection } from './CustomScriptSection';
import { DesktopIconsSection } from './DesktopIconsSection';
import { RegionLanguageSection } from './RegionLanguageSection';
import { VisualEffectsSection } from './VisualEffectsSection';
import { WindowsSettingsSection } from './WindowsSettingsSection';

export interface UnattendSectionCard {
  id: string;
  title: string;
  content: React.ReactNode;
}

export type UpdateUnattendConfig = <K extends keyof UnattendProfileConfig>(
  section: K,
  patch: Partial<UnattendProfileConfig[K]>,
) => void;

export const buildUnattendSectionCards = (
  config: UnattendProfileConfig,
  updateConfig: UpdateUnattendConfig,
): UnattendSectionCard[] => [
  {
    id: 'unattend-region',
    title: 'Region & Language',
    content: <RegionLanguageSection config={config} updateConfig={updateConfig} />,
  },
  {
    id: 'unattend-account',
    title: 'Account',
    content: <AccountSection config={config} updateConfig={updateConfig} />,
  },
  {
    id: 'unattend-visual',
    title: 'Visual Effects',
    content: <VisualEffectsSection config={config} updateConfig={updateConfig} />,
  },
  {
    id: 'unattend-desktop',
    title: 'Desktop & Icons',
    content: <DesktopIconsSection config={config} updateConfig={updateConfig} />,
  },
  {
    id: 'unattend-bloatware',
    title: 'Bloatware & Capabilities',
    content: <BloatwareSection config={config} updateConfig={updateConfig} />,
  },
  {
    id: 'unattend-windows',
    title: 'Windows Settings',
    content: <WindowsSettingsSection config={config} updateConfig={updateConfig} />,
  },
  {
    id: 'unattend-script',
    title: 'Custom Script',
    content: <CustomScriptSection config={config} updateConfig={updateConfig} />,
  },
];
