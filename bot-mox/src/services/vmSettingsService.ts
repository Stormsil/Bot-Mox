import type { VMConfigProfile, VMGeneratorSettings, VMHardwareConfig } from '../types';
import { apiGet, apiPatch, apiPut, createPollingSubscription } from './apiClient';

const SETTINGS_PATH = 'vmgenerator';
const VM_PROFILES_PATH = `${SETTINGS_PATH}/profiles`;
const SETTINGS_API_PREFIX = '/api/v1/settings';

const DEFAULT_DELETE_VM_FILTERS: NonNullable<VMGeneratorSettings['deleteVmFilters']> = {
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

const DEFAULT_SETTINGS: VMGeneratorSettings = {
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
    options: ['data', 'nvme0n1'],
    default: 'data',
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
    },
    wow_midnight: {
      cores: 2,
      memory: 4096,
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

function normalizeTinyFmUrl(input?: string): string {
  const fallback = DEFAULT_SETTINGS.services.tinyFmUrl;
  const raw = String(input || fallback).trim();
  try {
    const parsed = new URL(raw);
    parsed.searchParams.set('p', '');
    return parsed.toString();
  } catch {
    return fallback;
  }
}

function mergeSettings(data: Partial<VMGeneratorSettings> | undefined | null): VMGeneratorSettings {
  const legacyTiny = (data as Record<string, unknown> | null | undefined)?.tinyFM as Record<string, unknown> | undefined;
  const legacySyncThing = (data as Record<string, unknown> | null | undefined)?.syncThing as Record<string, unknown> | undefined;

  const servicesFromLegacy: Partial<VMGeneratorSettings['services']> = {};
  if (typeof legacyTiny?.url === 'string') servicesFromLegacy.tinyFmUrl = legacyTiny.url;
  if (typeof legacyTiny?.username === 'string') servicesFromLegacy.tinyFmUsername = legacyTiny.username;
  if (typeof legacyTiny?.password === 'string') servicesFromLegacy.tinyFmPassword = legacyTiny.password;
  if (typeof legacySyncThing?.url === 'string') servicesFromLegacy.syncThingUrl = legacySyncThing.url;
  if (typeof legacySyncThing?.username === 'string') servicesFromLegacy.syncThingUsername = legacySyncThing.username;
  if (typeof legacySyncThing?.password === 'string') servicesFromLegacy.syncThingPassword = legacySyncThing.password;

  return {
    ...DEFAULT_SETTINGS,
    ...data,
    proxmox: { ...DEFAULT_SETTINGS.proxmox, ...(data?.proxmox || {}) },
    ssh: { ...DEFAULT_SETTINGS.ssh, ...(data?.ssh || {}) },
    storage: { ...DEFAULT_SETTINGS.storage, ...(data?.storage || {}) },
    format: { ...DEFAULT_SETTINGS.format, ...(data?.format || {}) },
    template: { ...DEFAULT_SETTINGS.template, ...(data?.template || {}) },
    hardware: { ...DEFAULT_SETTINGS.hardware, ...(data?.hardware || {}) },
    projectHardware: {
      wow_tbc: {
        ...DEFAULT_SETTINGS.projectHardware.wow_tbc,
        ...(data?.projectHardware?.wow_tbc || {}),
      },
      wow_midnight: {
        ...DEFAULT_SETTINGS.projectHardware.wow_midnight,
        ...(data?.projectHardware?.wow_midnight || {}),
      },
    },
    hardwareApply: { ...DEFAULT_SETTINGS.hardwareApply, ...(data?.hardwareApply || {}) },
    services: {
      ...DEFAULT_SETTINGS.services,
      ...servicesFromLegacy,
      ...(data?.services || {}),
      tinyFmUrl: normalizeTinyFmUrl(
        (data?.services?.tinyFmUrl as string | undefined)
        ?? servicesFromLegacy.tinyFmUrl
        ?? DEFAULT_SETTINGS.services.tinyFmUrl
      ),
    },
    deleteVmFilters: {
      policy: {
        ...DEFAULT_DELETE_VM_FILTERS.policy,
        ...(data?.deleteVmFilters?.policy || {}),
      },
      view: {
        ...DEFAULT_DELETE_VM_FILTERS.view,
        ...(data?.deleteVmFilters?.view || {}),
      },
    },
  };
}

function normalizeApiPath(path: string): string {
  const normalized = String(path || '').trim().replace(/^\/+/, '').replace(/\/+$/, '');
  if (!normalized) {
    return SETTINGS_API_PREFIX;
  }
  return `${SETTINGS_API_PREFIX}/${normalized}`;
}

async function readSettingsPath<T>(path: string): Promise<T | undefined> {
  const response = await apiGet<T>(normalizeApiPath(path));
  return response.data;
}

interface VmProfilePayload {
  name: string;
  created_at: number;
  updated_at: number;
  hardware: VMHardwareConfig;
}

function profilesMapToArray(data: unknown): VMConfigProfile[] {
  if (!data || typeof data !== 'object') return [];
  return Object.entries(data as Record<string, VmProfilePayload>)
    .filter(([, profile]) => Boolean(profile))
    .map(([id, profile]) => ({
      id,
      name: profile?.name || 'Unnamed profile',
      created_at: Number(profile?.created_at || Date.now()),
      updated_at: Number(profile?.updated_at || Date.now()),
      hardware: profile?.hardware || DEFAULT_SETTINGS.hardware,
    }))
    .sort((a, b) => b.updated_at - a.updated_at);
}

export async function getVMSettings(): Promise<VMGeneratorSettings> {
  try {
    const data = await readSettingsPath<Partial<VMGeneratorSettings>>(SETTINGS_PATH);
    return mergeSettings(data);
  } catch (error) {
    console.error('Error loading VM settings:', error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Strip deprecated plaintext password fields before persisting to the backend.
 * Passwords are managed through the secrets vault (secret bindings) instead.
 */
export function stripPasswords(settings: Partial<VMGeneratorSettings>): Partial<VMGeneratorSettings> {
  const cleaned = structuredClone(settings);

  if (cleaned.proxmox) {
    delete cleaned.proxmox.password;
  }
  if (cleaned.ssh) {
    delete cleaned.ssh.password;
  }
  if (cleaned.services) {
    delete cleaned.services.tinyFmPassword;
    delete cleaned.services.syncThingPassword;
  }

  return cleaned;
}

export async function updateVMSettings(settings: Partial<VMGeneratorSettings>): Promise<void> {
  await apiPatch(normalizeApiPath(SETTINGS_PATH), settings);
}

export async function getVMConfigProfiles(): Promise<VMConfigProfile[]> {
  try {
    const data = await readSettingsPath<unknown>(VM_PROFILES_PATH);
    return profilesMapToArray(data);
  } catch (error) {
    console.error('Error loading VM config profiles:', error);
    return [];
  }
}

export async function saveVMConfigProfile(
  name: string,
  hardware: VMHardwareConfig,
  profileId?: string
): Promise<string> {
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error('Profile name is required');

  const now = Date.now();
  const payload = {
    name: trimmedName,
    updated_at: now,
    hardware,
  };

  if (profileId) {
    let createdAt = now;
    try {
      const existing = await readSettingsPath<VmProfilePayload>(`${VM_PROFILES_PATH}/${profileId}`);
      createdAt = Number(existing?.created_at || now);
    } catch {
      createdAt = now;
    }

    await apiPatch(normalizeApiPath(`${VM_PROFILES_PATH}/${profileId}`), {
      ...payload,
      created_at: createdAt,
    });
    return profileId;
  }

  const generatedId = `vm_profile_${now}_${Math.random().toString(36).slice(2, 8)}`;
  await apiPut(normalizeApiPath(`${VM_PROFILES_PATH}/${generatedId}`), {
    ...payload,
    created_at: now,
  });
  return generatedId;
}

export async function deleteVMConfigProfile(profileId: string): Promise<void> {
  if (!profileId) return;
  await apiPatch(normalizeApiPath(VM_PROFILES_PATH), {
    [profileId]: null,
  });
}

export function subscribeToVMSettings(
  callback: (settings: VMGeneratorSettings) => void
): () => void {
  return createPollingSubscription(
    async () => getVMSettings(),
    callback,
    (error) => {
      console.error('Error subscribing to VM settings:', error);
      callback(DEFAULT_SETTINGS);
    },
    { intervalMs: 4000, immediate: true }
  );
}

export { DEFAULT_SETTINGS };
