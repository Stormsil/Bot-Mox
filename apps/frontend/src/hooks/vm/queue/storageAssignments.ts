import type { VMQueueItem } from '../../../types';
import type { VMLog } from '../../useVMLog';
import {
  estimateProjectDiskBytes,
  loadStorageFreeBytes,
  pickBestStorageByFree,
} from './storageHeuristics';

interface BuildStorageAssignmentsParams {
  settings: {
    storage?: {
      autoSelectBest?: boolean;
      enabledDisks?: unknown[];
    };
    projectHardware?: Record<string, { diskGiB?: number }>;
  };
  targetNode: string;
  pendingCreateItems: VMQueueItem[];
  updateQueueItem: (id: string, updates: Partial<VMQueueItem>) => void;
  log: VMLog;
  legacyStoragePlaceholder: string;
}

export async function buildStorageAssignments(
  params: BuildStorageAssignmentsParams,
): Promise<Map<string, string>> {
  const {
    settings,
    targetNode,
    pendingCreateItems,
    updateQueueItem,
    log,
    legacyStoragePlaceholder,
  } = params;

  const storageAssignments = new Map<string, string>();

  if (!settings.storage?.autoSelectBest) {
    return storageAssignments;
  }

  const enabledTargets =
    Array.isArray(settings.storage.enabledDisks) && settings.storage.enabledDisks.length > 0
      ? Array.from(
          new Set(
            settings.storage.enabledDisks
              .map((v) => String(v).trim())
              .filter((value) => value && value.toLowerCase() !== legacyStoragePlaceholder),
          ),
        )
      : [];

  const statsCandidates: string[] = [];
  let remainingFree = new Map<string, number>();

  try {
    const freeBytesByStorage = await loadStorageFreeBytes(targetNode);
    statsCandidates.push(...Array.from(freeBytesByStorage.keys()));

    const normalizedEnabledTargets = enabledTargets.filter((name) => freeBytesByStorage.has(name));
    const pool = (
      normalizedEnabledTargets.length > 0 ? normalizedEnabledTargets : statsCandidates
    ).filter(Boolean);
    remainingFree = new Map(pool.map((name) => [name, freeBytesByStorage.get(name) ?? 0] as const));
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    log.warn(`Failed to load storage usage stats (${msg}). Falling back to basic balancing.`);
    const pool =
      enabledTargets.length > 0
        ? enabledTargets
        : pendingCreateItems.map((item) => String(item.storage || '').trim()).filter(Boolean);
    remainingFree = new Map(pool.map((name) => [name, 0] as const));
  }

  for (const item of pendingCreateItems) {
    if (item.storageMode !== 'manual') {
      continue;
    }

    const storage = String(item.storage || '').trim();
    if (!storage || !remainingFree.has(storage)) {
      continue;
    }

    const estimateBytes = estimateProjectDiskBytes({
      projectId: String(item.projectId),
      diskGiB:
        Number.isFinite(Number(item.diskGiB)) && Number(item.diskGiB) > 0
          ? Number(item.diskGiB)
          : settings.projectHardware?.[item.projectId]?.diskGiB,
    });
    remainingFree.set(storage, (remainingFree.get(storage) ?? 0) - estimateBytes);
  }

  const candidates = Array.from(remainingFree.keys());

  for (const item of pendingCreateItems) {
    if (item.storageMode === 'manual') {
      continue;
    }

    const estimateBytes = estimateProjectDiskBytes({
      projectId: String(item.projectId),
      diskGiB:
        Number.isFinite(Number(item.diskGiB)) && Number(item.diskGiB) > 0
          ? Number(item.diskGiB)
          : settings.projectHardware?.[item.projectId]?.diskGiB,
    });
    const picked = pickBestStorageByFree({
      candidates,
      freeBytesByStorage: remainingFree,
      estimateBytes,
    });

    if (!picked) {
      continue;
    }

    storageAssignments.set(item.id, picked);
    remainingFree.set(picked, (remainingFree.get(picked) ?? 0) - estimateBytes);
  }

  if (storageAssignments.size > 0) {
    for (const item of pendingCreateItems) {
      const assigned = storageAssignments.get(item.id);
      if (assigned && assigned !== item.storage) {
        updateQueueItem(item.id, { storage: assigned, storageMode: 'auto' });
      }
    }
  }

  return storageAssignments;
}
