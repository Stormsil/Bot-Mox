import type { Dispatch, SetStateAction } from 'react';
import type { ProxmoxVM, VMGeneratorSettings, VMQueueItem } from '../../../types';
import type { DeleteVmCandidateRow, DeleteVmFilters } from '../deleteVmRules';

export interface DeleteVmQueueApi {
  queue: VMQueueItem[];
  addDeleteTasks: (vms: ProxmoxVM[]) => number;
}

export interface UseDeleteVmWorkflowParams {
  queue: DeleteVmQueueApi;
  proxmoxVms: ProxmoxVM[];
  refreshVms: () => Promise<void> | void;
  templateVmId: number;
  settings: VMGeneratorSettings | null;
  setSettings: Dispatch<SetStateAction<VMGeneratorSettings | null>>;
}

export interface UseDeleteVmWorkflowResult {
  deleteVmModalOpen: boolean;
  deleteVmContextLoading: boolean;
  deleteVmSelection: number[];
  deleteVmCandidates: DeleteVmCandidateRow[];
  deleteVmFilters: DeleteVmFilters;
  deleteVmFiltersSaving: boolean;
  queuedDeleteVmIds: Set<number>;
  deleteVmAllowedCount: number;
  deleteVmSelectableCount: number;
  deleteVmPolicyEnabledCount: number;
  deleteVmViewEnabledCount: number;
  setDeleteVmModalOpen: Dispatch<SetStateAction<boolean>>;
  handleOpenDeleteVmModal: () => Promise<void>;
  handleConfirmDeleteVmTasks: () => void;
  handleToggleDeleteVm: (vmid: number, checked: boolean) => void;
  handleSelectAllDeleteVm: () => void;
  handleClearDeleteVmSelection: () => void;
  handleDeletePolicyToggle: (key: keyof DeleteVmFilters['policy'], value: boolean) => void;
  handleDeleteViewToggle: (key: keyof DeleteVmFilters['view'], value: boolean) => void;
}
