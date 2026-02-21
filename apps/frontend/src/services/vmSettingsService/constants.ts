import type { VMGeneratorSettings } from '../../types';

export const SETTINGS_PATH = 'vmgenerator';
export const VM_PROFILES_PATH = `${SETTINGS_PATH}/profiles`;
export const SETTINGS_API_PREFIX = '/api/v1/settings';

export const DEFAULT_DELETE_VM_FILTERS: NonNullable<VMGeneratorSettings['deleteVmFilters']> = {
  policy: {
    allowBanned: true,
    allowPrepareNoResources: true,
    allowOrphan: true,
  },
  view: {
    showAllowed: true,
    showLocked: true,
    showRunning: true,
    showStopped: true,
  },
};

export const COMPAT_STORAGE_PLACEHOLDER = 'disk';
/** @deprecated Use COMPAT_STORAGE_PLACEHOLDER. */
export const LEGACY_STORAGE_PLACEHOLDER = COMPAT_STORAGE_PLACEHOLDER;
export const FALLBACK_STORAGE_VALUES = ['data', 'nvme0n1'];

export const DEFAULT_SETTINGS: VMGeneratorSettings = {
  proxmox: {
    url: 'https://127.0.0.1:8006/',
    username: '',
    node: 'h1',
  },
  ssh: {
    host: '127.0.0.1',
    port: 22,
    username: '',
    useKeyAuth: true,
  },
  storage: {
    options: [...FALLBACK_STORAGE_VALUES],
    enabledDisks: [...FALLBACK_STORAGE_VALUES],
    autoSelectBest: true,
    default: FALLBACK_STORAGE_VALUES[0],
  },
  format: {
    options: ['raw', 'qcow2'],
    default: 'raw',
  },
  template: {
    vmId: 100,
    name: 'VM 100',
  },
  hardware: {
    cores: 2,
    sockets: 1,
    memory: 4096,
    balloon: 0,
    cpu: 'host',
    onboot: false,
    agent: false,
  },
  projectHardware: {
    wow_tbc: {
      cores: 2,
      memory: 4096,
      diskGiB: 128,
    },
    wow_midnight: {
      cores: 2,
      memory: 4096,
      diskGiB: 256,
    },
  },
  hardwareApply: {
    applyCpu: false,
    applyOnboot: false,
    applyAgent: false,
  },
  services: {
    proxmoxUrl: 'https://127.0.0.1:8006/',
    tinyFmUrl: 'http://127.0.0.1:8080/index.php?p=',
    syncThingUrl: 'https://127.0.0.1:8384/',
    proxmoxAutoLogin: false,
    tinyFmAutoLogin: false,
    tinyFmUsername: '',
    syncThingAutoLogin: false,
    syncThingUsername: '',
  },
  deleteVmFilters: DEFAULT_DELETE_VM_FILTERS,
};
