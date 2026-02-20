import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ProxmoxTargetInfo } from '../../../entities/vm/api/vmReadFacade';
import {
  getSelectedProxmoxTargetId,
  setSelectedProxmoxTargetId,
  setSelectedProxmoxTargetNode,
} from '../../../entities/vm/api/vmSelectionFacade';
import type { VMGeneratorSettings } from '../../../types';
import { showTargetLoadError } from '../page/templateHardwareSync';

interface UseVmTargetSelectionParams {
  targets: ProxmoxTargetInfo[];
  targetsError: Error | null;
  settings: VMGeneratorSettings | null;
  setSettingsOverride: Dispatch<SetStateAction<VMGeneratorSettings | null>>;
  checkConnections: () => Promise<unknown>;
  refreshVms: () => Promise<unknown>;
  refreshStorageOptions: () => Promise<unknown>;
  syncTemplateHardwareFromApi: () => Promise<unknown>;
}

interface UseVmTargetSelectionResult {
  selectedTargetId?: string;
  effectiveSelectedTargetId?: string;
  handleTargetChange: (nextTargetId?: string) => void;
}

export function useVmTargetSelection({
  targets,
  targetsError,
  settings,
  setSettingsOverride,
  checkConnections,
  refreshVms,
  refreshStorageOptions,
  syncTemplateHardwareFromApi,
}: UseVmTargetSelectionParams): UseVmTargetSelectionResult {
  const [selectedTargetId, setSelectedTargetId] = useState<string | undefined>(
    () => getSelectedProxmoxTargetId() || undefined,
  );

  const effectiveSelectedTargetId = useMemo(() => {
    const selectedFromState = selectedTargetId
      ? targets.find((target) => target.id === selectedTargetId)
      : undefined;
    if (selectedFromState) {
      return selectedFromState.id;
    }

    const persistedTargetId = getSelectedProxmoxTargetId();
    const selectedFromStorage = persistedTargetId
      ? targets.find((target) => target.id === persistedTargetId)
      : undefined;
    if (selectedFromStorage) {
      return selectedFromStorage.id;
    }

    return targets.find((target) => target.isActive)?.id;
  }, [selectedTargetId, targets]);

  useEffect(() => {
    const selectedTarget = targets.find((target) => target.id === effectiveSelectedTargetId);
    setSelectedProxmoxTargetId(effectiveSelectedTargetId || null);
    setSelectedProxmoxTargetNode(selectedTarget?.node || null);
  }, [effectiveSelectedTargetId, targets]);

  useEffect(() => {
    showTargetLoadError(targetsError);
  }, [targetsError]);

  const handleTargetChange = useCallback(
    (nextTargetId?: string) => {
      const normalizedTargetId = String(nextTargetId || '').trim() || undefined;
      setSelectedTargetId(normalizedTargetId);
      setSelectedProxmoxTargetId(normalizedTargetId || null);

      const selectedTarget = targets.find((target) => target.id === normalizedTargetId);
      setSelectedProxmoxTargetNode(selectedTarget?.node || null);
      if (selectedTarget?.node) {
        setSettingsOverride((previous) => {
          const baseSettings = previous || settings;
          if (!baseSettings) return previous;

          return {
            ...baseSettings,
            proxmox: {
              ...(baseSettings.proxmox || {}),
              node: selectedTarget.node,
            },
          };
        });
      }

      void checkConnections();
      void refreshVms();
      void refreshStorageOptions();
      void syncTemplateHardwareFromApi();
    },
    [
      checkConnections,
      refreshStorageOptions,
      refreshVms,
      setSettingsOverride,
      settings,
      syncTemplateHardwareFromApi,
      targets,
    ],
  );

  return {
    selectedTargetId,
    effectiveSelectedTargetId,
    handleTargetChange,
  };
}
