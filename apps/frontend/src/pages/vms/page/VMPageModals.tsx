import { Modal } from 'antd';
import type React from 'react';
import { VMSettingsForm } from '../../../components/vm';
import type { VMStorageOption } from '../../../types';
import { DeleteVmModal } from '../DeleteVmModal';
import type { UseDeleteVmWorkflowResult } from '../hooks/deleteVmWorkflow.types';

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
      title={
        <span style={{ color: 'var(--boxmox-color-text-primary)', fontWeight: 700, fontSize: 13 }}>
          Virtual Machines Settings
        </span>
      }
      open={panelOpen === 'settings'}
      onCancel={() => setPanelOpen(null)}
      footer={null}
      width={1100}
      destroyOnHidden
      styles={{
        mask: {
          background: 'rgba(var(--boxmox-color-brand-primary-rgb), 0.08)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        },
        content: {
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--boxmox-color-border-default)',
          background: 'var(--boxmox-color-surface-panel)',
          overflow: 'hidden',
        },
        header: {
          borderBottom: '1px solid var(--boxmox-color-border-default)',
          background: 'var(--boxmox-color-surface-muted)',
          padding: '10px 14px',
        },
        body: {
          maxHeight: '74vh',
          overflow: 'auto',
          background: 'var(--boxmox-color-surface-panel)',
        },
      }}
    >
      <VMSettingsForm storageOptions={storageOptions} />
    </Modal>
  </>
);
