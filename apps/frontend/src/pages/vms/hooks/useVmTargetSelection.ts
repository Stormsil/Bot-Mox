import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ProxmoxTargetInfo } from '../../../entities/vm/api/vmReadFacade';
import {
  getSelectedProxmoxTargetId,
  setSelectedProxmoxTargetId,
  setSelectedProxmoxTargetNode,
} from '../../../entities/vm/api/vmSelectionFacade';
import type { VMGeneratorSettings } from '../../../shared/types';
import { showTargetLoadError } from '../page/templateHardwareSync';

interface UseVmTargetSelectionParams {
  targets: ProxmoxTargetInfo[];
  targetsError: Error | null;
  settings: VMGeneratorSettings | null;
  setSettingsOverride: Dispatch<SetStateAction<VMGeneratorSettings | null>>;
  checkConnections: () => Promise<unknown>;
  refreshVms: () => Promise<unknown>;
  refreshStorageOptions: () => Promise<unknown>;
  syncTemplateHardwareFromApi: (options?: { isCurrent?: () => boolean }) => Promise<unknown>;
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
  const targetChangeSeqRef = useRef(0);

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

      const seq = targetChangeSeqRef.current + 1;
      targetChangeSeqRef.current = seq;
      const isCurrent = () => targetChangeSeqRef.current === seq;

      void Promise.allSettled([
        Promise.resolve().then(() => (isCurrent() ? checkConnections() : undefined)),
        Promise.resolve().then(() => (isCurrent() ? refreshVms() : undefined)),
        Promise.resolve().then(() => (isCurrent() ? refreshStorageOptions() : undefined)),
        Promise.resolve().then(() =>
          isCurrent() ? syncTemplateHardwareFromApi({ isCurrent }) : undefined,
        ),
      ]);
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
