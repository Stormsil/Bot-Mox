import React from 'react';
import { Modal } from 'antd';
import { VMConfigPreview, VMSettingsForm } from '../../../components/vm';
import { DeleteVmModal } from '../DeleteVmModal';
import type { UseDeleteVmWorkflowResult } from '../hooks/deleteVmWorkflow.types';

interface VMPageModalsProps {
  panelOpen: 'settings' | 'preview' | null;
  setPanelOpen: React.Dispatch<React.SetStateAction<'settings' | 'preview' | null>>;
  deleteVm: UseDeleteVmWorkflowResult;
}

export const VMPageModals: React.FC<VMPageModalsProps> = ({
  panelOpen,
  setPanelOpen,
  deleteVm,
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
      title="VM Generator Settings"
      open={panelOpen === 'settings'}
      onCancel={() => setPanelOpen(null)}
      footer={null}
      width={760}
      destroyOnClose
      className="vm-generator-modal"
      styles={{ body: { maxHeight: '74vh', overflow: 'auto' } }}
    >
      <VMSettingsForm />
    </Modal>

    <Modal
      title="Config Preview"
      open={panelOpen === 'preview'}
      onCancel={() => setPanelOpen(null)}
      footer={null}
      width={760}
      destroyOnClose
      className="vm-generator-modal"
      styles={{ body: { maxHeight: '74vh', overflow: 'auto' } }}
    >
      <VMConfigPreview />
    </Modal>
  </>
);
