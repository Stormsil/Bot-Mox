import { type ApiSuccessEnvelope, apiDelete, apiGet, apiPost, apiPut } from '../services/apiClient';
import { DEFAULT_UNATTEND_XML_TEMPLATE } from '../utils/unattendXml';

const PROFILES_PREFIX = '/api/v1/unattend-profiles';
const PROVISIONING_PREFIX = '/api/v1/provisioning';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UnattendUserConfig {
  nameMode: 'random' | 'fixed' | 'custom';
  customName?: string;
  customNameSuffix?: 'none' | 'random_digits' | 'sequential';
  displayName?: string;
  password: string;
  group: 'Administrators' | 'Users';
  autoLogonCount: number;
}

export interface UnattendComputerNameConfig {
  mode: 'random' | 'fixed' | 'custom';
  customName?: string;
}

export interface KeyboardLayoutPair {
  language: string;
  layout: string;
}

export interface UnattendLocaleConfig {
  uiLanguage: string;
  keyboardLayouts: KeyboardLayoutPair[];
  timeZone: string;
  geoLocation: number;
}

export interface UnattendSoftwareRemovalConfig {
  mode: 'fixed' | 'random' | 'fixed_random';
  fixedPackages: string[];
  randomPool: string[];
  neverRemove: string[];
  randomCount?: { min: number; max: number };
}

export interface UnattendCapabilityRemovalConfig {
  mode: 'fixed' | 'random' | 'fixed_random';
  fixedCapabilities: string[];
  randomPool: string[];
}

export interface UnattendWindowsSettings {
  disableDefender: boolean;
  disableWindowsUpdate: boolean;
  disableUac: boolean;
  disableSmartScreen: boolean;
  disableSystemRestore: boolean;
  enableLongPaths: boolean;
  allowPowerShellScripts: boolean;
  disableWidgets: boolean;
  disableEdgeStartup: boolean;
  preventDeviceEncryption: boolean;
  disableStickyKeys: boolean;
  enableRemoteDesktop: boolean;
}

export interface UnattendVisualEffects {
  mode: 'default' | 'appearance' | 'performance' | 'custom' | 'custom_randomize';
  effects: Record<string, boolean>;
}

export interface UnattendDesktopIcons {
  mode: 'default' | 'custom' | 'custom_randomize';
  icons: Record<string, boolean>;
  startFolders: Record<string, boolean>;
  deleteEdgeShortcut: boolean;
}

export interface UnattendCustomScript {
  executable: string;
  delaySeconds: number;
}

export interface UnattendProfileConfig {
  user: UnattendUserConfig;
  computerName: UnattendComputerNameConfig;
  locale: UnattendLocaleConfig;
  softwareRemoval: UnattendSoftwareRemovalConfig;
  capabilityRemoval: UnattendCapabilityRemovalConfig;
  windowsSettings: UnattendWindowsSettings;
  visualEffects: UnattendVisualEffects;
  desktopIcons: UnattendDesktopIcons;
  customScript: UnattendCustomScript;
  xmlTemplate?: string;
}

export interface UnattendProfile {
  id: string;
  tenant_id: string;
  user_id: string;
  name: string;
  is_default: boolean;
  config: UnattendProfileConfig;
  created_at: string;
  updated_at: string;
}

export interface GenerateIsoPayloadRequest {
  profile_id?: string;
  profile_config?: UnattendProfileConfig;
  playbook_id?: string;
  vm_uuid: string;
  ip: {
    address: string;
    netmask: string;
    gateway: string;
    dns: string[];
  };
  vm_name?: string;
}

export interface GenerateIsoPayloadResponse {
  files: Record<string, string>;
  token: string;
  tokenId: string;
  expiresAt: string;
  computerName: string;
  username: string;
  vmUuid: string;
}

export interface VmSetupProgressEntry {
  id: string;
  tenant_id: string;
  vm_uuid: string;
  token_id: string | null;
  step: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  details: Record<string, unknown>;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Default config (used when creating new profiles)
// ---------------------------------------------------------------------------

export const DEFAULT_PROFILE_CONFIG: UnattendProfileConfig = {
  user: {
    nameMode: 'random',
    password: '1204',
    group: 'Administrators',
    autoLogonCount: 9999999,
  },
  computerName: {
    mode: 'random',
  },
  locale: {
    uiLanguage: 'en-US',
    keyboardLayouts: [{ language: '0409', layout: '00000409' }],
    timeZone: 'Turkey Standard Time',
    geoLocation: 235,
  },
  softwareRemoval: {
    mode: 'fixed',
    fixedPackages: [],
    randomPool: [],
    neverRemove: [],
  },
  capabilityRemoval: {
    mode: 'fixed',
    fixedCapabilities: [],
    randomPool: [],
  },
  windowsSettings: {
    disableDefender: true,
    disableWindowsUpdate: true,
    disableUac: true,
    disableSmartScreen: true,
    disableSystemRestore: true,
    enableLongPaths: true,
    allowPowerShellScripts: true,
    disableWidgets: true,
    disableEdgeStartup: true,
    preventDeviceEncryption: true,
    disableStickyKeys: true,
    enableRemoteDesktop: false,
  },
  visualEffects: {
    mode: 'performance',
    effects: {},
  },
  desktopIcons: {
    mode: 'default',
    icons: {},
    startFolders: {},
    deleteEdgeShortcut: true,
  },
  customScript: {
    executable: 'START.exe',
    delaySeconds: 20,
  },
  xmlTemplate: DEFAULT_UNATTEND_XML_TEMPLATE,
};

function isLegacyStubTemplate(xmlTemplate: string): boolean {
  const normalized = xmlTemplate.replace(/\s+/g, ' ').toLowerCase();
  return (
    normalized.includes('default template generated from schneegans unattend generator') &&
    normalized.includes('c:\\windows\\setup\\scripts\\useronce.ps1') &&
    !normalized.includes('c:\\windows\\setup\\scripts\\specialize.ps1')
  );
}

// ---------------------------------------------------------------------------
// Migration: backwards-compat for old profile configs
// ---------------------------------------------------------------------------

interface LegacyLocaleConfig extends Partial<UnattendLocaleConfig> {
  inputLocales?: string[];
}

interface LegacyVisualEffectsConfig extends Omit<Partial<UnattendVisualEffects>, 'mode'> {
  mode?: UnattendVisualEffects['mode'] | 'balanced' | 'random';
  cursorShadow?: boolean;
  fontSmoothing?: boolean;
}

interface LegacyDesktopIconsConfig extends Partial<UnattendDesktopIcons> {
  recycleBin?: boolean;
  thisPC?: boolean;
}

interface LegacyProfileConfig {
  user?: Partial<UnattendUserConfig>;
  computerName?: Partial<UnattendComputerNameConfig>;
  locale?: LegacyLocaleConfig;
  softwareRemoval?: Omit<Partial<UnattendSoftwareRemovalConfig>, 'mode'> & {
    mode?: UnattendSoftwareRemovalConfig['mode'] | 'mixed';
  };
  capabilityRemoval?: Omit<Partial<UnattendCapabilityRemovalConfig>, 'mode'> & {
    mode?: UnattendCapabilityRemovalConfig['mode'] | 'mixed';
  };
  windowsSettings?: Partial<UnattendWindowsSettings>;
  visualEffects?: LegacyVisualEffectsConfig;
  desktopIcons?: LegacyDesktopIconsConfig;
  customScript?: Partial<UnattendCustomScript>;
  xmlTemplate?: string;
}

export function migrateProfileConfig(raw: unknown): UnattendProfileConfig {
  if (!raw || typeof raw !== 'object') return structuredClone(DEFAULT_PROFILE_CONFIG);

  const config: LegacyProfileConfig = structuredClone(raw as LegacyProfileConfig);

  // user: add autoLogonCount if missing
  if (config.user) {
    if (config.user.autoLogonCount === undefined) config.user.autoLogonCount = 9999999;
    if (config.user.customNameSuffix === undefined) config.user.customNameSuffix = 'none';
  } else {
    config.user = structuredClone(DEFAULT_PROFILE_CONFIG.user);
  }

  // locale: migrate inputLocales → keyboardLayouts
  if (config.locale) {
    if (!config.locale.keyboardLayouts && Array.isArray(config.locale.inputLocales)) {
      config.locale.keyboardLayouts = config.locale.inputLocales.map((il: string) => {
        const parts = String(il).split(':');
        return { language: parts[0] || '0409', layout: parts[1] || '00000409' };
      });
      delete config.locale.inputLocales;
    }
    if (!config.locale.keyboardLayouts) {
      config.locale.keyboardLayouts = structuredClone(
        DEFAULT_PROFILE_CONFIG.locale.keyboardLayouts,
      );
    }
  } else {
    config.locale = structuredClone(DEFAULT_PROFILE_CONFIG.locale);
  }

  // softwareRemoval: migrate 'mixed' → 'fixed_random', add neverRemove
  if (config.softwareRemoval) {
    if (config.softwareRemoval.mode === 'mixed') config.softwareRemoval.mode = 'fixed_random';
    if (!Array.isArray(config.softwareRemoval.neverRemove)) config.softwareRemoval.neverRemove = [];
  } else {
    config.softwareRemoval = structuredClone(DEFAULT_PROFILE_CONFIG.softwareRemoval);
  }

  // capabilityRemoval: migrate 'mixed' → 'fixed_random'
  if (config.capabilityRemoval) {
    if (config.capabilityRemoval.mode === 'mixed') config.capabilityRemoval.mode = 'fixed_random';
  } else {
    config.capabilityRemoval = structuredClone(DEFAULT_PROFILE_CONFIG.capabilityRemoval);
  }

  // windowsSettings: add enableRemoteDesktop
  if (config.windowsSettings) {
    if (config.windowsSettings.enableRemoteDesktop === undefined)
      config.windowsSettings.enableRemoteDesktop = false;
  } else {
    config.windowsSettings = structuredClone(DEFAULT_PROFILE_CONFIG.windowsSettings);
  }

  // visualEffects: migrate old cursorShadow/fontSmoothing to effects Record
  if (config.visualEffects) {
    if (!config.visualEffects.effects || typeof config.visualEffects.effects !== 'object') {
      config.visualEffects.effects = {};
    }
    // migrate old mode names
    if (config.visualEffects.mode === 'balanced') config.visualEffects.mode = 'default';
    if (config.visualEffects.mode === 'random') config.visualEffects.mode = 'custom_randomize';
    // migrate legacy per-effect booleans
    if (config.visualEffects.cursorShadow !== undefined) {
      config.visualEffects.effects.cursorShadow = config.visualEffects.cursorShadow;
      delete config.visualEffects.cursorShadow;
    }
    if (config.visualEffects.fontSmoothing !== undefined) {
      config.visualEffects.effects.fontSmoothing = config.visualEffects.fontSmoothing;
      delete config.visualEffects.fontSmoothing;
    }
  } else {
    config.visualEffects = structuredClone(DEFAULT_PROFILE_CONFIG.visualEffects);
  }

  // desktopIcons: migrate old flat booleans to new structure
  if (config.desktopIcons) {
    if (config.desktopIcons.mode === undefined) {
      // old format: { recycleBin: bool, thisPC: bool }
      const oldIcons: Record<string, boolean> = {};
      if (config.desktopIcons.recycleBin !== undefined)
        oldIcons.recycleBin = config.desktopIcons.recycleBin;
      if (config.desktopIcons.thisPC !== undefined) oldIcons.thisPC = config.desktopIcons.thisPC;
      config.desktopIcons = {
        mode: 'custom',
        icons: oldIcons,
        startFolders: {},
        deleteEdgeShortcut: true,
      };
    }
    if (!config.desktopIcons.icons) config.desktopIcons.icons = {};
    if (!config.desktopIcons.startFolders) config.desktopIcons.startFolders = {};
    if (config.desktopIcons.deleteEdgeShortcut === undefined)
      config.desktopIcons.deleteEdgeShortcut = true;
  } else {
    config.desktopIcons = structuredClone(DEFAULT_PROFILE_CONFIG.desktopIcons);
  }

  // customScript: add if missing
  if (!config.customScript) {
    config.customScript = structuredClone(DEFAULT_PROFILE_CONFIG.customScript);
  }

  const resolvedTemplate = typeof config.xmlTemplate === 'string' ? config.xmlTemplate.trim() : '';
  if (!resolvedTemplate || isLegacyStubTemplate(resolvedTemplate)) {
    config.xmlTemplate = DEFAULT_UNATTEND_XML_TEMPLATE;
  }

  // computerName: ensure exists
  if (!config.computerName) {
    config.computerName = structuredClone(DEFAULT_PROFILE_CONFIG.computerName);
  }

  return config as UnattendProfileConfig;
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

export async function listUnattendProfiles(): Promise<ApiSuccessEnvelope<UnattendProfile[]>> {
  return apiGet<UnattendProfile[]>(PROFILES_PREFIX);
}

export async function createUnattendProfile(payload: {
  name: string;
  is_default?: boolean;
  config: UnattendProfileConfig;
}): Promise<ApiSuccessEnvelope<UnattendProfile>> {
  return apiPost<UnattendProfile>(PROFILES_PREFIX, payload);
}

export async function updateUnattendProfile(
  id: string,
  payload: {
    name?: string;
    is_default?: boolean;
    config?: UnattendProfileConfig;
  },
): Promise<ApiSuccessEnvelope<UnattendProfile>> {
  return apiPut<UnattendProfile>(`${PROFILES_PREFIX}/${id}`, payload);
}

export async function deleteUnattendProfile(id: string): Promise<void> {
  await apiDelete(`${PROFILES_PREFIX}/${id}`);
}

export async function generateIsoPayload(
  request: GenerateIsoPayloadRequest,
): Promise<ApiSuccessEnvelope<GenerateIsoPayloadResponse>> {
  return apiPost<GenerateIsoPayloadResponse>(
    `${PROVISIONING_PREFIX}/generate-iso-payload`,
    request,
  );
}

export async function getVmSetupProgress(
  vmUuid: string,
): Promise<ApiSuccessEnvelope<VmSetupProgressEntry[]>> {
  return apiGet<VmSetupProgressEntry[]>(`${PROVISIONING_PREFIX}/progress/${vmUuid}`);
}
