import { Modal } from 'antd';
import type React from 'react';
import type { UseDeleteVmWorkflowResult } from '../../../features/vm-management';
import { DeleteVmModal } from '../../../features/vm-management/ui/DeleteVmModal';
import type { VMStorageOption } from '../../../types';
import { VMSettingsForm } from '../../../widgets/vm';

interface VMPageModalsProps {
  panelOpen: 'settings' | null;
  setPanelOpen: React.Dispatch<React.SetStateAction<'settings' | null>>;
  deleteVm: UseDeleteVmWorkflowResult;
  storageOptions: VMStorageOption[];
}

export const VMPageModals: React.FC<VMPageModalsProps> = ({
  panelOpen,
  setPanelOpen,
  deleteVm,
  storageOptions,
}) => (
  <>
    <DeleteVmModal
      open={deleteVm.deleteVmModalOpen}
      loading={deleteVm.deleteVmContextLoading}
      selection={deleteVm.deleteVmSelection}
      candidates={deleteVm.deleteVmCandidates}
      allowedCount={deleteVm.deleteVmAllowedCount}
      selectableCount={deleteVm.deleteVmSelectableCount}
      policyEnabledCount={deleteVm.deleteVmPolicyEnabledCount}
      viewEnabledCount={deleteVm.deleteVmViewEnabledCount}
      filters={deleteVm.deleteVmFilters}
      filtersSaving={deleteVm.deleteVmFiltersSaving}
      queuedDeleteVmIds={deleteVm.queuedDeleteVmIds}
      onClose={() => deleteVm.setDeleteVmModalOpen(false)}
      onConfirm={deleteVm.handleConfirmDeleteVmTasks}
      onPolicyToggle={deleteVm.handleDeletePolicyToggle}
      onViewToggle={deleteVm.handleDeleteViewToggle}
      onToggleSelection={deleteVm.handleToggleDeleteVm}
      onSelectAll={deleteVm.handleSelectAllDeleteVm}
      onClearSelection={deleteVm.handleClearDeleteVmSelection}
    />

    <Modal
      title="Virtual Machines Settings"
      open={panelOpen === 'settings'}
      onCancel={() => setPanelOpen(null)}
      footer={null}
      width={1100}
      destroyOnHidden
    >
      <VMSettingsForm storageOptions={storageOptions} />
    </Modal>
  </>
);
