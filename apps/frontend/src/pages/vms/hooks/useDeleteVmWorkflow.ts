import { message } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useUpdateVmSettingsMutation } from '../../../entities/vm/api/useVmActionMutations';
import {
  type DeleteVmBotRecord,
  type DeleteVmLicenseRecord,
  type DeleteVmProxyRecord,
  type DeleteVmSubscriptionRecord,
  fetchDeleteVmContext,
} from '../../../entities/vm/api/vmDeleteContextFacade';
import {
  type DeleteVmCandidateRow,
  type DeleteVmFilters,
  normalizeDeleteVmFilters,
} from '../deleteVmRules';
import type {
  UseDeleteVmWorkflowParams,
  UseDeleteVmWorkflowResult,
} from './deleteVmWorkflow.types';
import {
  buildDeleteVmCandidatesRaw,
  collectSelectableDeleteVmIds,
  filterDeleteVmCandidates,
} from './deleteVmWorkflowCandidates';

export const useDeleteVmWorkflow = ({
  queue,
  proxmoxVms,
  refreshVms,
  templateVmId,
  settings,
  setSettings,
}: UseDeleteVmWorkflowParams): UseDeleteVmWorkflowResult => {
  const updateVmSettingsMutation = useUpdateVmSettingsMutation();
  const [deleteVmModalOpen, setDeleteVmModalOpen] = useState(false);
  const [deleteVmSelection, setDeleteVmSelection] = useState<number[]>([]);
  const [deleteVmContextLoading, setDeleteVmContextLoading] = useState(false);
  const [deleteVmBots, setDeleteVmBots] = useState<Record<string, DeleteVmBotRecord>>({});
  const [deleteVmProxies, setDeleteVmProxies] = useState<DeleteVmProxyRecord[]>([]);
  const [deleteVmSubscriptions, setDeleteVmSubscriptions] = useState<DeleteVmSubscriptionRecord[]>(
    [],
  );
  const [deleteVmLicenses, setDeleteVmLicenses] = useState<DeleteVmLicenseRecord[]>([]);
  const [deleteVmFiltersSaving, setDeleteVmFiltersSaving] = useState(false);

  const deleteVmFilters = useMemo(
    () => normalizeDeleteVmFilters(settings?.deleteVmFilters),
    [settings?.deleteVmFilters],
  );

  const queuedDeleteVmIds = useMemo(() => {
    const ids = new Set<number>();
    queue.queue.forEach((item) => {
      if ((item.action || 'create') !== 'delete') {
        return;
      }

      const vmid = Number(item.targetVmId ?? item.vmId);
      if (Number.isInteger(vmid) && vmid > 0) {
        ids.add(vmid);
      }
    });

    return ids;
  }, [queue.queue]);

  const updateDeleteVmFilters = useCallback(
    async (updater: (current: DeleteVmFilters) => DeleteVmFilters) => {
      const current = normalizeDeleteVmFilters(settings?.deleteVmFilters);
      const next = updater(current);

      setSettings((prev) => {
        if (!prev) {
          return prev;
        }

        return {
          ...prev,
          deleteVmFilters: next,
        };
      });

      setDeleteVmFiltersSaving(true);
      try {
        await updateVmSettingsMutation.mutateAsync({ deleteVmFilters: next });
      } catch {
        message.error('Failed to save delete filters');
      } finally {
        setDeleteVmFiltersSaving(false);
      }
    },
    [settings?.deleteVmFilters, setSettings, updateVmSettingsMutation],
  );

  const handleDeletePolicyToggle = useCallback(
    (key: keyof DeleteVmFilters['policy'], value: boolean) => {
      void updateDeleteVmFilters((current) => ({
        ...current,
        policy: {
          ...current.policy,
          [key]: value,
        },
      }));
    },
    [updateDeleteVmFilters],
  );

  const handleDeleteViewToggle = useCallback(
    (key: keyof DeleteVmFilters['view'], value: boolean) => {
      void updateDeleteVmFilters((current) => ({
        ...current,
        view: {
          ...current.view,
          [key]: value,
        },
      }));
    },
    [updateDeleteVmFilters],
  );

  const loadDeleteVmContext = useCallback(async () => {
    setDeleteVmContextLoading(true);

    try {
      const context = await fetchDeleteVmContext();
      setDeleteVmBots(context.bots);
      setDeleteVmProxies(context.proxies);
      setDeleteVmSubscriptions(context.subscriptions);
      setDeleteVmLicenses(context.licenses);
    } catch {
      message.error('Failed to load linked account data for delete rules');
      setDeleteVmBots({});
      setDeleteVmProxies([]);
      setDeleteVmSubscriptions([]);
      setDeleteVmLicenses([]);
    } finally {
      setDeleteVmContextLoading(false);
    }
  }, []);

  const deleteVmCandidatesRaw = useMemo<DeleteVmCandidateRow[]>(() => {
    return buildDeleteVmCandidatesRaw({
      deleteVmBots,
      deleteVmProxies,
      deleteVmSubscriptions,
      deleteVmLicenses,
      proxmoxVms,
      templateVmId,
      policy: deleteVmFilters.policy,
    });
  }, [
    deleteVmBots,
    deleteVmFilters.policy,
    deleteVmLicenses,
    deleteVmProxies,
    deleteVmSubscriptions,
    proxmoxVms,
    templateVmId,
  ]);

  const deleteVmCandidates = useMemo(() => {
    return filterDeleteVmCandidates(deleteVmCandidatesRaw, deleteVmFilters.view);
  }, [deleteVmCandidatesRaw, deleteVmFilters.view]);

  const selectableDeleteVmIds = useMemo(() => {
    return collectSelectableDeleteVmIds(deleteVmCandidates, queuedDeleteVmIds);
  }, [deleteVmCandidates, queuedDeleteVmIds]);

  const deleteVmSelectableCount = useMemo(
    () =>
      deleteVmCandidates.filter((candidate) => selectableDeleteVmIds.has(candidate.vm.vmid)).length,
    [deleteVmCandidates, selectableDeleteVmIds],
  );

  const deleteVmAllowedCount = useMemo(
    () => deleteVmCandidates.filter((candidate) => candidate.canDelete).length,
    [deleteVmCandidates],
  );

  const deleteVmPolicyEnabledCount = useMemo(
    () => Object.values(deleteVmFilters.policy).filter(Boolean).length,
    [deleteVmFilters.policy],
  );

  const deleteVmViewEnabledCount = useMemo(
    () => Object.values(deleteVmFilters.view).filter(Boolean).length,
    [deleteVmFilters.view],
  );

  useEffect(() => {
    setDeleteVmSelection((prev) => prev.filter((vmid) => selectableDeleteVmIds.has(vmid)));
  }, [selectableDeleteVmIds]);

  const handleOpenDeleteVmModal = useCallback(async () => {
    setDeleteVmSelection([]);
    setDeleteVmModalOpen(true);

    try {
      await Promise.all([Promise.resolve(refreshVms()), loadDeleteVmContext()]);
    } catch {
      // noop
    }
  }, [loadDeleteVmContext, refreshVms]);

  const handleToggleDeleteVm = useCallback(
    (vmid: number, checked: boolean) => {
      if (!selectableDeleteVmIds.has(vmid)) {
        return;
      }

      setDeleteVmSelection((prev) => {
        if (checked) {
          if (prev.includes(vmid)) {
            return prev;
          }

          return [...prev, vmid];
        }

        return prev.filter((id) => id !== vmid);
      });
    },
    [selectableDeleteVmIds],
  );

  const handleSelectAllDeleteVm = useCallback(() => {
    setDeleteVmSelection(Array.from(selectableDeleteVmIds));
  }, [selectableDeleteVmIds]);

  const handleClearDeleteVmSelection = useCallback(() => {
    setDeleteVmSelection([]);
  }, []);

  const handleConfirmDeleteVmTasks = useCallback(() => {
    const selected = deleteVmCandidates.filter(
      (candidate) =>
        deleteVmSelection.includes(candidate.vm.vmid) &&
        candidate.canDelete &&
        !queuedDeleteVmIds.has(candidate.vm.vmid),
    );

    if (selected.length === 0) {
      message.warning('Select at least one VM to add delete tasks');
      return;
    }

    const added = queue.addDeleteTasks(selected.map((candidate) => candidate.vm));
    if (added === 0) {
      message.warning('Selected VMs are already in delete queue');
      return;
    }

    message.success(`Added ${added} delete task${added === 1 ? '' : 's'} to queue`);
    setDeleteVmModalOpen(false);
    setDeleteVmSelection([]);
  }, [deleteVmCandidates, deleteVmSelection, queue, queuedDeleteVmIds]);

  return {
    deleteVmModalOpen,
    deleteVmContextLoading,
    deleteVmSelection,
    deleteVmCandidates,
    deleteVmFilters,
    deleteVmFiltersSaving,
    queuedDeleteVmIds,
    deleteVmAllowedCount,
    deleteVmSelectableCount,
    deleteVmPolicyEnabledCount,
    deleteVmViewEnabledCount,
    setDeleteVmModalOpen,
    handleOpenDeleteVmModal,
    handleConfirmDeleteVmTasks,
    handleToggleDeleteVm,
    handleSelectAllDeleteVm,
    handleClearDeleteVmSelection,
    handleDeletePolicyToggle,
    handleDeleteViewToggle,
  };
};
