import { DEFAULT_UNATTEND_XML_TEMPLATE } from '../../utils/unattendXml';
import type { UnattendProfileConfig } from './types';

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

export function isCompatStubTemplate(xmlTemplate: string): boolean {
  const normalized = xmlTemplate.replace(/\s+/g, ' ').toLowerCase();
  return (
    normalized.includes('default template generated from schneegans unattend generator') &&
    normalized.includes('c:\\windows\\setup\\scripts\\useronce.ps1') &&
    !normalized.includes('c:\\windows\\setup\\scripts\\specialize.ps1')
  );
}

/** @deprecated Use isCompatStubTemplate. */
export const isLegacyStubTemplate = isCompatStubTemplate;
