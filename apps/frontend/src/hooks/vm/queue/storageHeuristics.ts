import { getClusterResources } from '../../../services/vmService';

const PROJECT_DISK_FALLBACK_GIB: Record<string, number> = {
  wow_tbc: 128,
  wow_midnight: 256,
};

const RESIZE_VOLUME_KEY = /^(?:ide|sata|scsi|virtio)\d+$/i;

export function estimateProjectDiskBytes(params: { projectId: string; diskGiB?: unknown }): number {
  const configured = Number(params.diskGiB);
  const gib =
    Number.isFinite(configured) && configured > 0
      ? configured
      : (PROJECT_DISK_FALLBACK_GIB[params.projectId] ?? 128);
  return gib * 1024 ** 3;
}

export async function loadStorageFreeBytes(targetNode: string): Promise<Map<string, number>> {
  const freeBytes = new Map<string, number>();

  const resources = await getClusterResources('storage');
  for (const resource of resources) {
    if (resource.type !== 'storage') {
      continue;
    }
    if (
      resource.node &&
      String(resource.node).trim() &&
      String(resource.node).trim() !== targetNode
    ) {
      continue;
    }

    const storageName = String(resource.storage || '').trim();
    if (!storageName) {
      continue;
    }

    const used = Number(resource.disk);
    const total = Number(resource.maxdisk);
    if (!Number.isFinite(used) || used < 0 || !Number.isFinite(total) || total <= 0) {
      continue;
    }

    freeBytes.set(storageName, Math.max(0, total - used));
  }

  return freeBytes;
}

export function pickBestStorageByFree(params: {
  candidates: string[];
  freeBytesByStorage: Map<string, number>;
  estimateBytes: number;
}): string | null {
  const candidates = params.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return null;
  }

  let best: { name: string; free: number } | null = null;
  let bestFits: { name: string; free: number } | null = null;

  for (const name of candidates) {
    const free = Number(params.freeBytesByStorage.get(name));
    if (!Number.isFinite(free)) {
      continue;
    }

    if (!best || free > best.free) {
      best = { name, free };
    }

    if (free >= params.estimateBytes) {
      if (!bestFits || free > bestFits.free) {
        bestFits = { name, free };
      }
    }
  }

  return bestFits?.name || best?.name || candidates[0] || null;
}

function parseSizeBytesFromVolume(value: unknown): number | null {
  const text = String(value ?? '').trim();
  if (!text) return null;

  const match = text.match(/(?:^|,)\s*size=([0-9]+(?:\.[0-9]+)?)([KMGTP])?\s*(?:,|$)/i);
  if (!match) return null;

  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const unit = (match[2] || 'B').toUpperCase();
  const mul =
    unit === 'K'
      ? 1024
      : unit === 'M'
        ? 1024 ** 2
        : unit === 'G'
          ? 1024 ** 3
          : unit === 'T'
            ? 1024 ** 4
            : unit === 'P'
              ? 1024 ** 5
              : 1;

  return Math.round(amount * mul);
}

export function pickPrimaryVolumeFromConfig(
  config: Record<string, unknown>,
): { disk: string; sizeBytes: number } | null {
  let best: { disk: string; sizeBytes: number } | null = null;

  for (const [key, value] of Object.entries(config)) {
    if (!RESIZE_VOLUME_KEY.test(key)) {
      continue;
    }

    const sizeBytes = parseSizeBytesFromVolume(value);
    if (!sizeBytes) {
      continue;
    }

    if (!best || sizeBytes > best.sizeBytes) {
      best = { disk: key, sizeBytes };
    }
  }

  return best;
}

export function bytesToGiBRounded(bytes: number): number {
  const gib = bytes / 1024 ** 3;
  if (!Number.isFinite(gib) || gib <= 0) {
    return 0;
  }

  return Math.round(gib);
}
