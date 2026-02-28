import { message } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useProxmoxTargetsQuery } from '../../../entities/vm/api/useVmQueries';
import {
  getSelectedProxmoxTargetId,
  setSelectedProxmoxTargetId,
  setSelectedProxmoxTargetNode,
} from '../../../entities/vm/api/vmSelectionFacade';

interface UseVmTargetStripModelParams {
  onTargetChanged?: (options: { isCurrent: () => boolean }) => Promise<unknown> | unknown;
}

export function useVmTargetStripModel({ onTargetChanged }: UseVmTargetStripModelParams) {
  const targetsQuery = useProxmoxTargetsQuery();
  const targets = useMemo(() => targetsQuery.data || [], [targetsQuery.data]);
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
    const error = (targetsQuery.error as Error | null) || null;
    if (error) {
      message.warning(error.message || 'Failed to load computers');
    }
  }, [targetsQuery.error]);

  const handleTargetChange = useCallback(
    (nextTargetId?: string) => {
      const normalizedTargetId = String(nextTargetId || '').trim() || undefined;
      setSelectedTargetId(normalizedTargetId);
      setSelectedProxmoxTargetId(normalizedTargetId || null);

      const selectedTarget = targets.find((target) => target.id === normalizedTargetId);
      setSelectedProxmoxTargetNode(selectedTarget?.node || null);

      const seq = targetChangeSeqRef.current + 1;
      targetChangeSeqRef.current = seq;
      const isCurrent = () => targetChangeSeqRef.current === seq;

      if (onTargetChanged) {
        void Promise.resolve(onTargetChanged({ isCurrent }));
      }
    },
    [onTargetChanged, targets],
  );

  const handleRefresh = useCallback(() => {
    void targetsQuery.refetch();
  }, [targetsQuery]);

  return {
    targets,
    selectedTargetId: effectiveSelectedTargetId,
    loading: targetsQuery.isLoading || targetsQuery.isFetching,
    handleTargetChange,
    handleRefresh,
  };
}
