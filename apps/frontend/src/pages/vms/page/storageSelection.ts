import type { VMGeneratorSettings, VMQueueItem, VMStorageOption } from '../../../types';

const VM_PROJECT_DISK_FALLBACK_GIB: Record<string, number> = {
  wow_tbc: 128,
  wow_midnight: 256,
};

export function estimateProjectDiskBytes(
  settings: VMGeneratorSettings | null | undefined,
  projectId: string,
): number {
  const projectConfig =
    projectId === 'wow_tbc' || projectId === 'wow_midnight'
      ? settings?.projectHardware?.[projectId]
      : undefined;
  const configured = Number(projectConfig?.diskGiB);
  const gib =
    Number.isFinite(configured) && configured > 0
      ? configured
      : (VM_PROJECT_DISK_FALLBACK_GIB[projectId] ?? 128);
  return gib * 1024 ** 3;
}

interface SelectStorageParams {
  settings: VMGeneratorSettings | null | undefined;
  storageOptions: VMStorageOption[];
  queueItems: VMQueueItem[];
  defaultProjectId: 'wow_tbc' | 'wow_midnight';
}

export function selectStorageForNewVm(params: SelectStorageParams): string {
  const { settings, storageOptions, queueItems, defaultProjectId } = params;
  const autoSelectBest = settings?.storage?.autoSelectBest ?? true;
  const configuredDefaultStorage = String(settings?.storage?.default || '').trim();
  const enabledTargets =
    Array.isArray(settings?.storage?.enabledDisks) && settings.storage.enabledDisks.length > 0
      ? settings.storage.enabledDisks
      : storageOptions.map((opt) => opt.value);

  const estimateBytes = estimateProjectDiskBytes(settings, defaultProjectId);

  const freeBytesByStorage = new Map<string, number>();
  for (const opt of storageOptions) {
    const used = Number(opt.usedBytes);
    const total = Number(opt.totalBytes);
    if (!Number.isFinite(used) || used < 0 || !Number.isFinite(total) || total <= 0) {
      continue;
    }
    freeBytesByStorage.set(opt.value, Math.max(0, total - used));
  }

  const reservedBytesByStorage = new Map<string, number>();
  for (const item of queueItems) {
    if ((item.action || 'create') === 'delete') {
      continue;
    }
    if (!['pending', 'cloned', 'cloning', 'configuring'].includes(item.status)) {
      continue;
    }

    const storage = String(item.storage || '').trim();
    if (!storage) {
      continue;
    }

    const itemProject = item.projectId as 'wow_tbc' | 'wow_midnight';
    const customDiskGiB = Number(item.diskGiB);
    const itemEstimateBytes =
      Number.isFinite(customDiskGiB) && customDiskGiB > 0
        ? customDiskGiB * 1024 ** 3
        : estimateProjectDiskBytes(settings, itemProject);

    reservedBytesByStorage.set(
      storage,
      (reservedBytesByStorage.get(storage) ?? 0) + itemEstimateBytes,
    );
  }

  const candidates =
    enabledTargets.length > 0 ? enabledTargets : storageOptions.map((opt) => opt.value);
  const available = candidates.filter((name) => storageOptions.some((opt) => opt.value === name));
  const pool = available.length > 0 ? available : storageOptions.map((opt) => opt.value);

  if (!autoSelectBest) {
    if (configuredDefaultStorage && pool.includes(configuredDefaultStorage)) {
      return configuredDefaultStorage;
    }
    return pool[0] || 'data';
  }

  let best: { name: string; free: number } | null = null;
  let bestFits: { name: string; free: number } | null = null;

  for (const name of pool) {
    const free = freeBytesByStorage.get(name) ?? 0;
    const reserved = reservedBytesByStorage.get(name) ?? 0;
    const effectiveFree = free - reserved;

    if (!best || effectiveFree > best.free) {
      best = { name, free: effectiveFree };
    }
    if (effectiveFree >= estimateBytes) {
      if (!bestFits || effectiveFree > bestFits.free) {
        bestFits = { name, free: effectiveFree };
      }
    }
  }

  return bestFits?.name || best?.name || pool[0] || configuredDefaultStorage || 'data';
}
