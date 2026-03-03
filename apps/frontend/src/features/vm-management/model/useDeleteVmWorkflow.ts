import { message } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useUpdateVmSettingsMutation } from '../../../entities/vm/api/useVmActionMutations';
import {
  type DeleteVmEvaluationRecord,
  fetchDeleteVmEvaluations,
} from '../../../entities/vm/api/vmDeleteContextFacade';
import type { VMQueueItem } from '../../../shared/types';
import type { DeleteVmCandidateRow, DeleteVmFilters } from './deleteVm.types';
import type {
  UseDeleteVmWorkflowParams,
  UseDeleteVmWorkflowResult,
} from './deleteVmWorkflow.types';

const DEFAULT_DELETE_VM_FILTERS: DeleteVmFilters = {
  policy: {
    allowBanned: true,
    allowPrepareNoResources: true,
    allowOrphan: true,
  },
  view: {
    showAllowed: true,
    showLocked: true,
    showRunning: true,
    showStopped: true,
  },
};

function normalizeToken(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function normalizeDeleteVmFilters(input?: DeleteVmFilters): DeleteVmFilters {
  return {
    policy: {
      ...DEFAULT_DELETE_VM_FILTERS.policy,
      ...(input?.policy || {}),
    },
    view: {
      ...DEFAULT_DELETE_VM_FILTERS.view,
      ...(input?.view || {}),
    },
  };
}

export const useDeleteVmWorkflow = ({
  queue,
  queueItems,
  proxmoxVms,
  templateVmId,
  settings,
  setSettings,
}: UseDeleteVmWorkflowParams & { queueItems: VMQueueItem[] }): UseDeleteVmWorkflowResult => {
  const updateVmSettingsMutation = useUpdateVmSettingsMutation();
  const [deleteVmModalOpen, setDeleteVmModalOpen] = useState(false);
  const [deleteVmSelection, setDeleteVmSelection] = useState<number[]>([]);
  const [deleteVmContextLoading, setDeleteVmContextLoading] = useState(false);
  const [deleteVmEvaluationsByVmid, setDeleteVmEvaluationsByVmid] = useState<
    Record<string, DeleteVmEvaluationRecord>
  >({});
  const [deleteVmFiltersSaving, setDeleteVmFiltersSaving] = useState(false);

  const deleteVmFilters = useMemo(
    () => normalizeDeleteVmFilters(settings?.deleteVmFilters),
    [settings?.deleteVmFilters],
  );

  const queuedDeleteVmIds = useMemo(() => {
    const ids = new Set<number>();
    queueItems.forEach((item) => {
      if ((item.action || 'create') !== 'delete') {
        return;
      }

      const vmid = Number(item.targetVmId ?? item.vmId);
      if (Number.isInteger(vmid) && vmid > 0) {
        ids.add(vmid);
      }
    });

    return ids;
  }, [queueItems]);

  const updateDeleteVmFilters = useCallback(
    (updater: (current: DeleteVmFilters) => DeleteVmFilters) => {
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
      updateVmSettingsMutation.mutate(
        { deleteVmFilters: next },
        {
          onError: () => {
            message.error('Failed to save delete filters');
          },
          onSettled: () => {
            setDeleteVmFiltersSaving(false);
          },
        },
      );
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
      const evaluationsByVmid = await fetchDeleteVmEvaluations({
        evaluation: {
          items: proxmoxVms
            .filter((vm) => !vm.template)
            .filter((vm) => vm.vmid !== templateVmId)
            .map((vm) => ({ vmid: vm.vmid, name: vm.name })),
          policy: deleteVmFilters.policy,
          required: true,
        },
      });
      setDeleteVmEvaluationsByVmid(evaluationsByVmid);
    } catch {
      message.error('Failed to evaluate VM deletion rules');
      setDeleteVmEvaluationsByVmid({});
    } finally {
      setDeleteVmContextLoading(false);
    }
  }, [deleteVmFilters.policy, proxmoxVms, templateVmId]);

  const deleteVmCandidatesRaw = useMemo<DeleteVmCandidateRow[]>(() => {
    return [...proxmoxVms]
      .filter((vm) => !vm.template)
      .filter((vm) => vm.vmid !== templateVmId)
      .sort((first, second) => first.vmid - second.vmid)
      .map((vm) => {
        const backendDecision = deleteVmEvaluationsByVmid[String(vm.vmid)];
        const fallbackReason = 'Deletion decision unavailable from backend';
        const rawReasons = Array.isArray(backendDecision?.reasons)
          ? backendDecision.reasons.filter((reason) => String(reason || '').trim().length > 0)
          : [];
        const canDelete = backendDecision?.can_delete ?? false;
        const decisionReason =
          String(backendDecision?.reason || '').trim() || rawReasons[0] || fallbackReason;

        return {
          vm,
          canDelete,
          decisionReasonCode: backendDecision?.reason_code,
          decisionReasons: rawReasons,
          decisionReason,
        };
      });
  }, [deleteVmEvaluationsByVmid, proxmoxVms, templateVmId]);

  const deleteVmCandidates = useMemo(() => {
    return deleteVmCandidatesRaw.filter((candidate) => {
      const vmStatus = normalizeToken(candidate.vm.status);
      const statusAllowed =
        (vmStatus === 'running' && deleteVmFilters.view.showRunning) ||
        (vmStatus === 'stopped' && deleteVmFilters.view.showStopped) ||
        (vmStatus !== 'running' && vmStatus !== 'stopped');

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
      await loadDeleteVmContext();
    } catch {
      // noop
    }
  }, [loadDeleteVmContext]);

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
