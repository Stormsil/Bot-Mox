import type { ProxmoxClusterResource, VMStorageOption } from '../../../types';

export const STORAGE_VOLUME_KEY = /^(?:ide|sata|scsi|virtio|efidisk|tpmstate)\d+$/i;
export const HIDDEN_STORAGE_NAMES = new Set(['local']);
export const FALLBACK_STORAGE_VALUES = ['data', 'nvme0n1'];
export const MAX_VM_CONFIG_SAMPLE = 12;
export const VM_CONFIG_SAMPLE_MAX_VM_COUNT = 60;

export const STORAGE_CAPACITY_RETRY_MAX_ATTEMPTS = 6;
export const STORAGE_CAPACITY_RETRY_BASE_DELAY_MS = 2_500;
export const STORAGE_CAPACITY_RETRY_MAX_DELAY_MS = 15_000;

export type StorageStat = {
  vmCount: number;
  usedBytes?: number;
  totalBytes?: number;
};

export const extractStorageFromVolume = (value: unknown): string | null => {
  const text = String(value ?? '').trim();
  if (!text) {
    return null;
  }

  const match = text.match(/^([^:,]+):/);
  if (!match) {
    return null;
  }

  const storage = match[1].trim();
  return storage || null;
};

const formatGigabytes = (bytes: number): string => {
  const gb = bytes / 1_000_000_000;
  if (!Number.isFinite(gb) || gb < 0) {
    return '0';
  }

  if (gb >= 100) {
    return gb.toFixed(1);
  }

  return gb.toFixed(2);
};

const formatUsagePercent = (usedBytes: number, totalBytes: number): string => {
  if (!Number.isFinite(usedBytes) || !Number.isFinite(totalBytes) || totalBytes <= 0) {
    return '0';
  }

  const percent = (usedBytes / totalBytes) * 100;
  if (!Number.isFinite(percent) || percent < 0) {
    return '0';
  }

  if (percent >= 10) {
    return percent.toFixed(0);
  }

  return percent.toFixed(1);
};

export const isStorageAllowed = (storageName: string): boolean => {
  const normalized = String(storageName || '')
    .trim()
    .toLowerCase();
  if (!normalized) {
    return false;
  }

  return !HIDDEN_STORAGE_NAMES.has(normalized);
};

export const storageSupportsVmDisks = (resource: ProxmoxClusterResource): boolean => {
  const contentRaw = String(resource.content ?? '')
    .trim()
    .toLowerCase();
  if (!contentRaw) {
    return true;
  }

  const parts = contentRaw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.includes('images');
};

export const buildStorageDetails = (stats?: StorageStat): string => {
  const vmCount = stats?.vmCount ?? 0;
  const usedBytes = Number(stats?.usedBytes);
  const totalBytes = Number(stats?.totalBytes);
  const hasCapacity =
    Number.isFinite(usedBytes) && usedBytes >= 0 && Number.isFinite(totalBytes) && totalBytes > 0;
  const vmLabel = vmCount === 1 ? 'VM' : 'VMs';

  if (hasCapacity) {
    const percent = formatUsagePercent(usedBytes, totalBytes);
    return `${vmCount} ${vmLabel} | ${formatGigabytes(usedBytes)} / ${formatGigabytes(totalBytes)} GB | ${percent}% used`;
  }

  return `${vmCount} ${vmLabel}`;
};

export const uniqueStorageValues = (values: string[] | undefined): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const rawValue of values || []) {
    const value = String(rawValue || '').trim();
    if (!isStorageAllowed(value) || seen.has(value)) {
      continue;
    }

    seen.add(value);
    result.push(value);
  }

  return result;
};

export const mapStorageValuesToOptions = (values: string[]): VMStorageOption[] => {
  return values.map((value) => ({
    value,
    label: value,
    details: '',
  }));
};

export const numericFromResource = (value: ProxmoxClusterResource['disk']): number | undefined => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return undefined;
  }

  return parsed;
};
