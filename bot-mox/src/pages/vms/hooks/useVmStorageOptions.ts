import { useCallback, useRef, useState } from 'react';
import {
  getClusterResources,
  getVMConfig,
  listVMs,
} from '../../../services/vmService';
import type {
  ProxmoxClusterResource,
  ProxmoxVM,
  VMGeneratorSettings,
  VMStorageOption,
} from '../../../types';

const STORAGE_VOLUME_KEY = /^(?:ide|sata|scsi|virtio|efidisk|tpmstate)\d+$/i;
const HIDDEN_STORAGE_NAMES = new Set(['local']);
const FALLBACK_STORAGE_VALUES = ['data', 'nvme0n1'];

const extractStorageFromVolume = (value: unknown): string | null => {
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

const isStorageAllowed = (storageName: string): boolean => {
  const normalized = String(storageName || '').trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return !HIDDEN_STORAGE_NAMES.has(normalized);
};

const storageSupportsVmDisks = (resource: ProxmoxClusterResource): boolean => {
  const contentRaw = String(resource.content ?? '').trim().toLowerCase();
  if (!contentRaw) {
    return true;
  }

  const parts = contentRaw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.includes('images');
};

const buildStorageDetails = (
  stats?: { vmCount: number; usedBytes?: number; totalBytes?: number }
): string => {
  const vmCount = stats?.vmCount ?? 0;
  const usedBytes = Number(stats?.usedBytes);
  const totalBytes = Number(stats?.totalBytes);
  const hasCapacity =
    Number.isFinite(usedBytes)
    && usedBytes >= 0
    && Number.isFinite(totalBytes)
    && totalBytes > 0;
  const vmLabel = vmCount === 1 ? 'VM' : 'VMs';

  if (hasCapacity) {
    const percent = formatUsagePercent(usedBytes, totalBytes);
    return `${vmCount} ${vmLabel} | ${formatGigabytes(usedBytes)} / ${formatGigabytes(totalBytes)} GB | ${percent}% used`;
  }

  return `${vmCount} ${vmLabel}`;
};

const uniqueStorageValues = (values: string[] | undefined): string[] => {
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

const mapStorageValuesToOptions = (values: string[]): VMStorageOption[] => {
  return values.map((value) => ({
    value,
    label: value,
    details: '',
  }));
};

const numericFromResource = (value: ProxmoxClusterResource['disk']): number | undefined => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return undefined;
  }

  return parsed;
};

interface UseVmStorageOptionsParams {
  settings: VMGeneratorSettings | null;
  proxmoxNode: string;
  proxmoxVmsRef: React.MutableRefObject<ProxmoxVM[]>;
}

interface UseVmStorageOptionsResult {
  storageOptions: VMStorageOption[];
  refreshStorageOptions: (explicitSettings?: VMGeneratorSettings | null) => Promise<void>;
}

export const useVmStorageOptions = ({
  settings,
  proxmoxNode,
  proxmoxVmsRef,
}: UseVmStorageOptionsParams): UseVmStorageOptionsResult => {
  const [storageOptions, setStorageOptions] = useState<VMStorageOption[]>(
    mapStorageValuesToOptions(FALLBACK_STORAGE_VALUES)
  );
  const storageRefreshSeqRef = useRef(0);

  const refreshStorageOptions = useCallback(
    async (explicitSettings?: VMGeneratorSettings | null) => {
      const activeSettings = explicitSettings || settings;
      if (!activeSettings) {
        return;
      }

      const requestId = ++storageRefreshSeqRef.current;
      const configuredStorage = uniqueStorageValues(activeSettings.storage?.options);
      const node = activeSettings.proxmox?.node || proxmoxNode || 'h1';
      type StorageStat = { vmCount: number; usedBytes?: number; totalBytes?: number };
      const storageStats = new Map<string, StorageStat>();

      const ensureStorage = (storageName: string) => {
        const normalized = storageName.trim();
        if (!normalized) {
          return null;
        }

        const existing = storageStats.get(normalized);
        if (existing) {
          return existing;
        }

        const created: StorageStat = { vmCount: 0 };
        storageStats.set(normalized, created);
        return created;
      };

      try {
        const resources = await getClusterResources();

        for (const resource of resources) {
          if (resource.type !== 'storage') {
            continue;
          }
          if (resource.node && resource.node !== node) {
            continue;
          }
          if (!storageSupportsVmDisks(resource)) {
            continue;
          }

          const storageName = String(resource.storage || '').trim();
          if (!isStorageAllowed(storageName)) {
            continue;
          }

          const entry = ensureStorage(storageName);
          if (!entry) {
            continue;
          }

          const used = numericFromResource(resource.disk);
          const total = numericFromResource(resource.maxdisk);
          if (used !== undefined) {
            entry.usedBytes = used;
          }
          if (total !== undefined) {
            entry.totalBytes = total;
          }
        }
      } catch {
        // noop
      }

      let vmList = proxmoxVmsRef.current;
      if (!vmList || vmList.length === 0) {
        try {
          vmList = await listVMs(node);
        } catch {
          vmList = [];
        }
      }

      if (vmList.length > 0) {
        const vmConfigResults = await Promise.allSettled(vmList.map((vm) => getVMConfig(vm.vmid, node)));

        vmConfigResults.forEach((result) => {
          if (result.status !== 'fulfilled') {
            return;
          }

          const config = result.value;
          const vmStorages = new Set<string>();
          for (const [key, value] of Object.entries(config)) {
            if (!STORAGE_VOLUME_KEY.test(key)) {
              continue;
            }

            const storageName = extractStorageFromVolume(value);
            if (storageName && isStorageAllowed(storageName)) {
              vmStorages.add(storageName);
            }
          }

          vmStorages.forEach((storageName) => {
            const entry = ensureStorage(storageName);
            if (entry) {
              entry.vmCount += 1;
            }
          });
        });
      }

      const allStorage = new Set<string>(configuredStorage);
      storageStats.forEach((_stats, storageName) => {
        allStorage.add(storageName);
      });

      if (allStorage.size === 0) {
        allStorage.add(activeSettings.storage?.default || 'data');
      }

      const options: VMStorageOption[] = Array.from(allStorage)
        .filter(Boolean)
        .sort((first, second) => first.localeCompare(second))
        .map((storageName) => ({
          value: storageName,
          label: storageName,
          details: buildStorageDetails(storageStats.get(storageName)),
        }));

      if (requestId !== storageRefreshSeqRef.current) {
        return;
      }

      setStorageOptions(options);
    },
    [settings, proxmoxNode, proxmoxVmsRef]
  );

  return {
    storageOptions,
    refreshStorageOptions,
  };
};
