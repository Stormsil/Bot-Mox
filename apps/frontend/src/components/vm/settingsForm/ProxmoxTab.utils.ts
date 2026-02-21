import type { VMStorageOption } from '../../../types';

export interface StorageRow {
  key: string;
  value: string;
  vmCount: number | null;
  usagePercent: number;
  usageLabel: string;
  freeLabel: string;
}

export const COMPAT_STORAGE_PLACEHOLDER = 'disk';

const formatGb = (bytes: number): string => {
  const gb = bytes / 1_000_000_000;
  if (!Number.isFinite(gb) || gb < 0) return '0.00';
  return gb.toFixed(2);
};

export const formatGiBFromMb = (memoryMb: number): string => {
  const gib = memoryMb / 1024;
  if (!Number.isFinite(gib) || gib <= 0) return '-';
  return gib >= 10 ? `${gib.toFixed(0)} GiB` : `${gib.toFixed(1)} GiB`;
};

export const formatGiBFromBytes = (bytes: number): string => {
  const gib = bytes / 1024 ** 3;
  if (!Number.isFinite(gib) || gib <= 0) return '-';
  return Number.isInteger(gib) ? `${gib.toFixed(0)} GiB` : `${gib.toFixed(1)} GiB`;
};

const buildStorageUsage = (
  opt: VMStorageOption,
): null | {
  percent: number;
  label: string;
  freeLabel: string;
} => {
  const used = Number(opt.usedBytes);
  const total = Number(opt.totalBytes);
  if (!Number.isFinite(used) || used < 0 || !Number.isFinite(total) || total <= 0) return null;

  const percent = (used / total) * 100;
  const safePercent = Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0;
  return {
    percent: safePercent,
    label: `${safePercent.toFixed(2)}% (${formatGb(used)} GB of ${formatGb(total)} GB)`,
    freeLabel: `${formatGb(Math.max(0, total - used))} GB free`,
  };
};

export const uniqueTrimmed = (values: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of values) {
    const value = String(raw || '').trim();
    if (!value) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }

  return result;
};

export const mapDisplayName = (value: unknown): string => {
  const rawText = String(value || '').trim();
  if (!rawText) return '-';

  const raw = rawText.toLowerCase();
  const model = raw.split(',')[0]?.trim() || raw;

  if (model === 'default') return 'Default';
  if (model === 'std') return 'Standard VGA (std)';
  if (model === 'vmware') return 'VMware compatible';
  if (model === 'qxl') return 'SPICE';
  if (model === 'qxl2') return 'SPICE dual monitor';
  if (model === 'qxl3') return 'SPICE three monitors';
  if (model === 'qxl4') return 'SPICE four monitors';
  if (model === 'serial0') return 'Serial terminal 0';
  if (model === 'serial1') return 'Serial terminal 1';
  if (model === 'serial2') return 'Serial terminal 2';
  if (model === 'serial3') return 'Serial terminal 3';
  if (model === 'virtio') return 'VirtIO-GPU';
  if (model === 'virtio-gl') return 'VirGL GPU';
  if (model === 'cirrus') return 'Cirrus VGA';
  if (model === 'none') return 'none';

  return model;
};

export const pickBestStorage = (
  storageCandidates: string[],
  storageByName: Map<string, VMStorageOption>,
  configuredDefault: string,
): string | null => {
  let best: { name: string; freeBytes: number } | null = null;

  for (const name of storageCandidates) {
    const opt = storageByName.get(name);
    const used = Number(opt?.usedBytes);
    const total = Number(opt?.totalBytes);
    if (!Number.isFinite(used) || used < 0 || !Number.isFinite(total) || total <= 0) {
      continue;
    }

    const freeBytes = total - used;
    if (!Number.isFinite(freeBytes) || freeBytes < 0) {
      continue;
    }

    if (!best || freeBytes > best.freeBytes) {
      best = { name, freeBytes };
    }
  }

  if (best) {
    return best.name;
  }

  if (configuredDefault && storageCandidates.includes(configuredDefault)) {
    return configuredDefault;
  }

  return storageCandidates[0] ?? null;
};

export const buildStorageRows = (
  candidatePool: string[],
  storageOptions: VMStorageOption[],
  storageByName: Map<string, VMStorageOption>,
): StorageRow[] =>
  (candidatePool.length > 0 ? candidatePool : storageOptions.map((opt) => opt.value)).map(
    (name) => {
      const opt = storageByName.get(name);
      const usage = opt ? buildStorageUsage(opt) : null;
      return {
        key: name,
        value: name,
        vmCount: typeof opt?.vmCount === 'number' ? opt.vmCount : null,
        usagePercent: usage?.percent ?? 0,
        usageLabel: usage?.label ?? (opt?.details || 'No usage data'),
        freeLabel: usage?.freeLabel ?? '-',
      };
    },
  );
