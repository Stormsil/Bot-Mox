import { useCallback, useEffect, useRef, useState } from 'react';

import { getClusterResources, getVMConfig, listVMs } from '../../../entities/vm/api/vmReadFacade';
import type { ProxmoxVM, VMGeneratorSettings, VMStorageOption } from '../../../types';
import {
  buildStorageDetails,
  extractStorageFromVolume,
  FALLBACK_STORAGE_VALUES,
  isStorageAllowed,
  MAX_VM_CONFIG_SAMPLE,
  mapStorageValuesToOptions,
  numericFromResource,
  STORAGE_CAPACITY_RETRY_BASE_DELAY_MS,
  STORAGE_CAPACITY_RETRY_MAX_ATTEMPTS,
  STORAGE_CAPACITY_RETRY_MAX_DELAY_MS,
  STORAGE_VOLUME_KEY,
  type StorageStat,
  storageSupportsVmDisks,
  uniqueStorageValues,
  VM_CONFIG_SAMPLE_MAX_VM_COUNT,
} from './useVmStorageOptions.helpers';

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
    mapStorageValuesToOptions(FALLBACK_STORAGE_VALUES),
  );
  const storageRefreshSeqRef = useRef(0);
  const storageRefreshInFlightRef = useRef(false);
  const capacityRetryAttemptRef = useRef(0);
  const capacityRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (capacityRetryTimerRef.current) {
        clearTimeout(capacityRetryTimerRef.current);
        capacityRetryTimerRef.current = null;
      }
    };
  }, []);

  const refreshStorageOptions = useCallback(
    async (explicitSettings?: VMGeneratorSettings | null) => {
      if (storageRefreshInFlightRef.current) {
        return;
      }
      storageRefreshInFlightRef.current = true;

      try {
        if (capacityRetryTimerRef.current) {
          clearTimeout(capacityRetryTimerRef.current);
          capacityRetryTimerRef.current = null;
        }

        const activeSettings = explicitSettings || settings;
        if (!activeSettings) {
          return;
        }

        const requestId = ++storageRefreshSeqRef.current;
        const configuredStorage = uniqueStorageValues(activeSettings.storage?.options);
        const node = activeSettings.proxmox?.node || proxmoxNode || 'h1';
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

        if (vmList.length > 0 && vmList.length <= VM_CONFIG_SAMPLE_MAX_VM_COUNT) {
          const vmConfigSample = vmList.slice(0, MAX_VM_CONFIG_SAMPLE);

          for (const vm of vmConfigSample) {
            try {
              const config = await getVMConfig(vm.vmid, node);
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
            } catch {
              // noop
            }
          }
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
          .map((storageName) => {
            const stat = storageStats.get(storageName);
            return {
              value: storageName,
              label: storageName,
              details: buildStorageDetails(stat),
              usedBytes: stat?.usedBytes,
              totalBytes: stat?.totalBytes,
              vmCount: stat?.vmCount ?? 0,
            };
          });

        if (requestId !== storageRefreshSeqRef.current) {
          return;
        }

        const hasCapacity = options.some((opt) => {
          const used = Number(opt.usedBytes);
          const total = Number(opt.totalBytes);
          return Number.isFinite(used) && used >= 0 && Number.isFinite(total) && total > 0;
        });

        if (hasCapacity) {
          capacityRetryAttemptRef.current = 0;
        } else if (capacityRetryAttemptRef.current < STORAGE_CAPACITY_RETRY_MAX_ATTEMPTS) {
          const attempt = capacityRetryAttemptRef.current;
          capacityRetryAttemptRef.current += 1;

          const delay = Math.min(
            STORAGE_CAPACITY_RETRY_MAX_DELAY_MS,
            STORAGE_CAPACITY_RETRY_BASE_DELAY_MS * 2 ** attempt,
          );

          capacityRetryTimerRef.current = setTimeout(() => {
            void refreshStorageOptions(activeSettings);
          }, delay);
        }

        setStorageOptions(options);
      } finally {
        storageRefreshInFlightRef.current = false;
      }
    },
    [settings, proxmoxNode, proxmoxVmsRef],
  );

  return {
    storageOptions,
    refreshStorageOptions,
  };
};
