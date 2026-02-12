import { message } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchDeleteVmContext,
  type DeleteVmBotRecord,
  type DeleteVmLicenseRecord,
  type DeleteVmProxyRecord,
  type DeleteVmSubscriptionRecord,
} from '../../../services/vmDeleteContextService';
import { updateVMSettings } from '../../../services/vmSettingsService';
import {
  evaluateDeleteBot,
  normalizeDeleteVmFilters,
  normalizeToken,
  type DeleteVmCandidateRow,
  type DeleteVmFilters,
} from '../deleteVmRules';
import type {
  UseDeleteVmWorkflowParams,
  UseDeleteVmWorkflowResult,
} from './deleteVmWorkflow.types';

export const useDeleteVmWorkflow = ({
  queue,
  proxmoxVms,
  refreshVms,
  templateVmId,
  settings,
  setSettings,
}: UseDeleteVmWorkflowParams): UseDeleteVmWorkflowResult => {
  const [deleteVmModalOpen, setDeleteVmModalOpen] = useState(false);
  const [deleteVmSelection, setDeleteVmSelection] = useState<number[]>([]);
  const [deleteVmContextLoading, setDeleteVmContextLoading] = useState(false);
  const [deleteVmBots, setDeleteVmBots] = useState<Record<string, DeleteVmBotRecord>>({});
  const [deleteVmProxies, setDeleteVmProxies] = useState<DeleteVmProxyRecord[]>([]);
  const [deleteVmSubscriptions, setDeleteVmSubscriptions] = useState<DeleteVmSubscriptionRecord[]>([]);
  const [deleteVmLicenses, setDeleteVmLicenses] = useState<DeleteVmLicenseRecord[]>([]);
  const [deleteVmFiltersSaving, setDeleteVmFiltersSaving] = useState(false);

  const deleteVmFilters = useMemo(
    () => normalizeDeleteVmFilters(settings?.deleteVmFilters),
    [settings?.deleteVmFilters]
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
        await updateVMSettings({ deleteVmFilters: next });
      } catch {
        message.error('Failed to save delete filters');
      } finally {
        setDeleteVmFiltersSaving(false);
      }
    },
    [settings?.deleteVmFilters, setSettings]
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
    [updateDeleteVmFilters]
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
    [updateDeleteVmFilters]
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
    const botsByVmName = new Map<string, DeleteVmBotRecord[]>();

    Object.values(deleteVmBots).forEach((bot) => {
      const key = normalizeToken(bot.vmName);
      if (!key) {
        return;
      }

      const current = botsByVmName.get(key);
      if (current) {
        current.push(bot);
      } else {
        botsByVmName.set(key, [bot]);
      }
    });

    const proxiesByBotId = new Map<string, number>();
    deleteVmProxies.forEach((record) => {
      proxiesByBotId.set(record.botId, (proxiesByBotId.get(record.botId) || 0) + 1);
    });

    const subscriptionsByBotId = new Map<string, number>();
    deleteVmSubscriptions.forEach((record) => {
      subscriptionsByBotId.set(record.botId, (subscriptionsByBotId.get(record.botId) || 0) + 1);
    });

    const licensesByBotId = new Map<string, number>();
    deleteVmLicenses.forEach((record) => {
      record.botIds.forEach((botId) => {
        licensesByBotId.set(botId, (licensesByBotId.get(botId) || 0) + 1);
      });
    });

    return [...proxmoxVms]
      .filter((vm) => !vm.template)
      .filter((vm) => vm.vmid !== templateVmId)
      .sort((first, second) => first.vmid - second.vmid)
      .map((vm) => {
        const linkedBots = botsByVmName.get(normalizeToken(vm.name)) || [];
        const evaluations = linkedBots.map((bot) =>
          evaluateDeleteBot(
            bot,
            {
              hasProxy: (proxiesByBotId.get(bot.id) || 0) > 0,
              hasSubscription: (subscriptionsByBotId.get(bot.id) || 0) > 0,
              hasLicense: (licensesByBotId.get(bot.id) || 0) > 0,
            },
            deleteVmFilters.policy
          )
        );

        let canDelete = false;
        let decisionReason = '';

        if (evaluations.length === 0) {
          canDelete = deleteVmFilters.policy.allowOrphan;
          decisionReason = deleteVmFilters.policy.allowOrphan
            ? 'Orphan VM: no linked account in database'
            : 'Orphan VM blocked by filter';
        } else {
          const blocked = evaluations.find((evaluation) => !evaluation.canDelete);
          if (blocked) {
            decisionReason = blocked.reason;
          } else {
            canDelete = true;
            decisionReason = evaluations[0]?.reason || 'Eligible for deletion';
          }
        }

        return {
          vm,
          linkedBots,
          evaluations,
          canDelete,
          decisionReason,
        };
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
    return deleteVmCandidatesRaw.filter((candidate) => {
      const vmStatus = normalizeToken(candidate.vm.status);
      const statusAllowed =
        (vmStatus === 'running' && deleteVmFilters.view.showRunning)
        || (vmStatus === 'stopped' && deleteVmFilters.view.showStopped)
        || (vmStatus !== 'running' && vmStatus !== 'stopped');

      if (!statusAllowed) {
        return false;
      }
      if (candidate.canDelete && !deleteVmFilters.view.showAllowed) {
        return false;
      }
      if (!candidate.canDelete && !deleteVmFilters.view.showLocked) {
        return false;
      }

      return true;
    });
  }, [deleteVmCandidatesRaw, deleteVmFilters.view]);

  const selectableDeleteVmIds = useMemo(() => {
    const ids = new Set<number>();

    deleteVmCandidates.forEach((candidate) => {
      if (!candidate.canDelete) {
        return;
      }
      if (queuedDeleteVmIds.has(candidate.vm.vmid)) {
        return;
      }

      ids.add(candidate.vm.vmid);
    });

    return ids;
  }, [deleteVmCandidates, queuedDeleteVmIds]);

  const deleteVmSelectableCount = useMemo(
    () => deleteVmCandidates.filter((candidate) => selectableDeleteVmIds.has(candidate.vm.vmid)).length,
    [deleteVmCandidates, selectableDeleteVmIds]
  );

  const deleteVmAllowedCount = useMemo(
    () => deleteVmCandidates.filter((candidate) => candidate.canDelete).length,
    [deleteVmCandidates]
  );

  const deleteVmPolicyEnabledCount = useMemo(
    () => Object.values(deleteVmFilters.policy).filter(Boolean).length,
    [deleteVmFilters.policy]
  );

  const deleteVmViewEnabledCount = useMemo(
    () => Object.values(deleteVmFilters.view).filter(Boolean).length,
    [deleteVmFilters.view]
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
    [selectableDeleteVmIds]
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
        deleteVmSelection.includes(candidate.vm.vmid)
        && candidate.canDelete
        && !queuedDeleteVmIds.has(candidate.vm.vmid)
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
