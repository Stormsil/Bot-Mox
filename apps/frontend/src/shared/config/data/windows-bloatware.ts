import { loadLazyJson } from './lazy-json';

/** Windows bloatware packages (AppxProvisionedPackage) with display names. */
export interface BloatwarePackage {
  id: string;
  name: string;
  category: 'microsoft' | 'xbox' | 'media' | 'productivity' | 'social' | 'other';
}

/** Windows capabilities that can be removed. */
export interface WindowsCapability {
  id: string;
  name: string;
}

/** Windows optional features that can be disabled. */
export interface WindowsFeature {
  id: string;
  name: string;
}

interface WindowsBloatwareDictionary {
  packages: BloatwarePackage[];
  capabilities: WindowsCapability[];
  features: WindowsFeature[];
}

const WINDOWS_BLOATWARE_URL = new URL('./windows-bloatware.json', import.meta.url).href;

export async function getWindowsBloatwarePackages(): Promise<BloatwarePackage[]> {
  const dictionary = await loadLazyJson<WindowsBloatwareDictionary>(WINDOWS_BLOATWARE_URL);
  return dictionary.packages;
}

export async function getWindowsCapabilities(): Promise<WindowsCapability[]> {
  const dictionary = await loadLazyJson<WindowsBloatwareDictionary>(WINDOWS_BLOATWARE_URL);
  return dictionary.capabilities;
}

export async function getWindowsFeatures(): Promise<WindowsFeature[]> {
  const dictionary = await loadLazyJson<WindowsBloatwareDictionary>(WINDOWS_BLOATWARE_URL);
  return dictionary.features;
}
