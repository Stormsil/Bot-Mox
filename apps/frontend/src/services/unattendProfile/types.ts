import { DEFAULT_UNATTEND_XML_TEMPLATE } from '../../utils/unattendXml';

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
