import type { VMGeneratorSettings } from '../../types';
import {
  DEFAULT_DELETE_VM_FILTERS,
  DEFAULT_SETTINGS,
  FALLBACK_STORAGE_VALUES,
  LEGACY_STORAGE_PLACEHOLDER,
} from './constants';

export function normalizeTinyFmUrl(input?: string): string {
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

export function normalizeStorageSettings(
  input: VMGeneratorSettings['storage'],
): VMGeneratorSettings['storage'] {
  const normalizeList = (value: unknown): string[] => {
    if (!Array.isArray(value)) {
      return [];
    }

    const seen = new Set<string>();
    const result: string[] = [];

    for (const rawEntry of value) {
      const entry = String(rawEntry ?? '').trim();
      if (!entry) {
        continue;
      }
      if (entry.toLowerCase() === LEGACY_STORAGE_PLACEHOLDER) {
        continue;
      }
      if (seen.has(entry)) {
        continue;
      }
      seen.add(entry);
      result.push(entry);
    }

    return result;
  };

  const optionsRaw = normalizeList(input.options);
  const enabledRaw = normalizeList(input.enabledDisks);
  const defaultRaw = String(input.default ?? '').trim();
  const defaultCandidate =
    defaultRaw && defaultRaw.toLowerCase() !== LEGACY_STORAGE_PLACEHOLDER ? defaultRaw : '';

  const options: string[] = [...optionsRaw];
  for (const entry of enabledRaw) {
    if (!options.includes(entry)) {
      options.push(entry);
    }
  }
  if (defaultCandidate && !options.includes(defaultCandidate)) {
    options.push(defaultCandidate);
  }

  if (options.length === 0) {
    options.push(...FALLBACK_STORAGE_VALUES);
  }

  let enabled =
    enabledRaw.length > 0 ? enabledRaw.filter((entry) => options.includes(entry)) : [...options];
  if (enabled.length === 0) {
    enabled = [...options];
  }

  const defaultValue =
    defaultCandidate && enabled.includes(defaultCandidate)
      ? defaultCandidate
      : enabled[0] || options[0] || FALLBACK_STORAGE_VALUES[0];

  return {
    ...input,
    options,
    enabledDisks: enabled,
    default: defaultValue,
  };
}

export function mergeSettings(
  data: Partial<VMGeneratorSettings> | undefined | null,
): VMGeneratorSettings {
  const legacyTiny = (data as Record<string, unknown> | null | undefined)?.tinyFM as
    | Record<string, unknown>
    | undefined;
  const legacySyncThing = (data as Record<string, unknown> | null | undefined)?.syncThing as
    | Record<string, unknown>
    | undefined;

  const servicesFromLegacy: Partial<VMGeneratorSettings['services']> = {};
  if (typeof legacyTiny?.url === 'string') servicesFromLegacy.tinyFmUrl = legacyTiny.url;
  if (typeof legacyTiny?.username === 'string') {
    servicesFromLegacy.tinyFmUsername = legacyTiny.username;
  }
  if (typeof legacyTiny?.password === 'string') {
    servicesFromLegacy.tinyFmPassword = legacyTiny.password;
  }
  if (typeof legacySyncThing?.url === 'string') {
    servicesFromLegacy.syncThingUrl = legacySyncThing.url;
  }
  if (typeof legacySyncThing?.username === 'string') {
    servicesFromLegacy.syncThingUsername = legacySyncThing.username;
  }
  if (typeof legacySyncThing?.password === 'string') {
    servicesFromLegacy.syncThingPassword = legacySyncThing.password;
  }

  const mergedStorage = normalizeStorageSettings({
    ...DEFAULT_SETTINGS.storage,
    ...(data?.storage || {}),
  });

  return {
    ...DEFAULT_SETTINGS,
    ...data,
    proxmox: { ...DEFAULT_SETTINGS.proxmox, ...(data?.proxmox || {}) },
    ssh: { ...DEFAULT_SETTINGS.ssh, ...(data?.ssh || {}) },
    storage: mergedStorage,
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
        (data?.services?.tinyFmUrl as string | undefined) ??
          servicesFromLegacy.tinyFmUrl ??
          DEFAULT_SETTINGS.services.tinyFmUrl,
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

export function stripPasswords(
  settings: Partial<VMGeneratorSettings>,
): Partial<VMGeneratorSettings> {
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
