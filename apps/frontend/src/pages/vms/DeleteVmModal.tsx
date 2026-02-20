import { DownOutlined, FilterOutlined } from '@ant-design/icons';
import { Button, Modal, Popover } from 'antd';
import type React from 'react';
import type { DeleteVmCandidateRow, DeleteVmFilters } from './deleteVmRules';
import { cx } from './page/cx';
import { DeleteVmCandidateItem } from './page/DeleteVmCandidateItem';
import {
  DeleteRulesPopoverContent,
  ViewFiltersPopoverContent,
} from './page/DeleteVmFilterPopovers';

interface DeleteVmModalProps {
  open: boolean;
  loading: boolean;
  selection: number[];
  candidates: DeleteVmCandidateRow[];
  allowedCount: number;
  selectableCount: number;
  policyEnabledCount: number;
  viewEnabledCount: number;
  filters: DeleteVmFilters;
  filtersSaving: boolean;
  queuedDeleteVmIds: Set<number>;
  onClose: () => void;
  onConfirm: () => void;
  onPolicyToggle: (key: keyof DeleteVmFilters['policy'], value: boolean) => void;
  onViewToggle: (key: keyof DeleteVmFilters['view'], value: boolean) => void;
  onToggleSelection: (vmid: number, checked: boolean) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
}

export const DeleteVmModal: React.FC<DeleteVmModalProps> = ({
  open,
  loading,
  selection,
  candidates,
  allowedCount,
  selectableCount,
  policyEnabledCount,
  viewEnabledCount,
  filters,
  filtersSaving,
  queuedDeleteVmIds,
  onClose,
  onConfirm,
  onPolicyToggle,
  onViewToggle,
  onToggleSelection,
  onSelectAll,
  onClearSelection,
}) => {
  const popoverInnerStyle: React.CSSProperties = {
    background: 'var(--boxmox-color-surface-panel)',
    border: '1px solid var(--boxmox-color-border-default)',
    borderRadius: 'var(--radius-md)',
  };

  return (
    <Modal
      title={
        <div className={cx('vm-delete-vm-modal-title-wrap')}>
          <span className={cx('vm-delete-vm-modal-title-main')}>Delete Existing VMs</span>
          <span className={cx('vm-delete-vm-modal-title-sub')}>
            Select VMs marked as ALLOWED and add them to delete queue tasks.
          </span>
        </div>
      }
      open={open}
      onCancel={onClose}
      onOk={onConfirm}
      okText="Add delete tasks"
      cancelText="Cancel"
      okButtonProps={{ disabled: loading || selection.length === 0, size: 'small' }}
      cancelButtonProps={{ size: 'small' }}
      width={980}
      className={cx('vm-generator-modal vm-delete-vm-modal')}
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
          boxShadow: '0 20px 54px rgba(0, 0, 0, 0.35)',
        },
        header: {
          minHeight: 38,
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'flex-start',
          background: 'var(--boxmox-color-surface-muted)',
          borderBottom: '1px solid var(--boxmox-color-border-default)',
        },
        body: {
          padding: '12px 14px 14px',
          background: 'var(--boxmox-color-surface-panel)',
        },
        footer: {
          borderTop: '1px solid var(--boxmox-color-border-default)',
          background: 'var(--boxmox-color-surface-muted)',
          padding: '8px 12px',
        },
      }}
    >
      <div className={cx('vm-delete-vm-modal-layout')}>
        <div className={cx('vm-delete-vm-modal-summary')}>
          <span className={cx('vm-delete-vm-summary-chip is-selected')}>
            <strong>{selection.length}</strong>
            Selected
          </span>
          <span className={cx('vm-delete-vm-summary-chip is-allowed')}>
            <strong>{allowedCount}</strong>
            Allowed
          </span>
          <span className={cx('vm-delete-vm-summary-chip is-visible')}>
            <strong>{candidates.length}</strong>
            Visible
          </span>
          <span className={cx('vm-delete-vm-summary-chip is-ready')}>
            <strong>{selectableCount}</strong>
            Ready to queue
          </span>
          {filtersSaving && (
            <span className={cx('vm-delete-vm-summary-chip is-saving')}>Saving filters...</span>
          )}
        </div>

        <div className={cx('vm-delete-vm-filter-toolbar')}>
          <div className={cx('vm-delete-vm-filter-toolbar-main')}>
            <Popover
              content={
                <DeleteRulesPopoverContent
                  filters={filters}
                  filtersSaving={filtersSaving}
                  onPolicyToggle={onPolicyToggle}
                  cx={cx}
                />
              }
              trigger="click"
              placement="bottomLeft"
              overlayClassName={cx('vm-delete-vm-filter-popover-overlay')}
              overlayInnerStyle={popoverInnerStyle}
            >
              <Button
                size="small"
                className={cx('vm-delete-vm-filter-trigger')}
                icon={<FilterOutlined />}
              >
                Delete rules
                <span className={cx('vm-delete-vm-filter-trigger-count')}>
                  {policyEnabledCount}/3
                </span>
                <DownOutlined />
              </Button>
            </Popover>
            <Popover
              content={
                <ViewFiltersPopoverContent
                  filters={filters}
                  filtersSaving={filtersSaving}
                  onViewToggle={onViewToggle}
                  cx={cx}
                />
              }
              trigger="click"
              placement="bottomLeft"
              overlayClassName={cx('vm-delete-vm-filter-popover-overlay')}
              overlayInnerStyle={popoverInnerStyle}
            >
              <Button
                size="small"
                className={cx('vm-delete-vm-filter-trigger')}
                icon={<FilterOutlined />}
              >
                View
                <span className={cx('vm-delete-vm-filter-trigger-count')}>
                  {viewEnabledCount}/4
                </span>
                <DownOutlined />
              </Button>
            </Popover>
          </div>
          <div className={cx('vm-delete-vm-selection-actions')}>
            <Button
              size="small"
              className={cx('vm-delete-vm-selection-btn')}
              disabled={selectableCount === 0}
              onClick={onSelectAll}
            >
              Select all allowed
            </Button>
            <Button
              size="small"
              className={cx('vm-delete-vm-selection-btn')}
              disabled={selection.length === 0}
              onClick={onClearSelection}
            >
              Clear selection
            </Button>
          </div>
        </div>

        <div className={cx('vm-delete-vm-list-shell')}>
          <div className={cx('vm-delete-vm-list-shell-title-row')}>
            <div className={cx('vm-delete-vm-list-shell-title')}>VM candidates</div>
            <div className={cx('vm-delete-vm-list-shell-note')}>
              Only rows marked <strong>ALLOWED</strong> can be queued
            </div>
          </div>
          <div className={cx('vm-delete-vm-modal-list')}>
            {loading ? (
              <div className={cx('vm-delete-vm-modal-empty')}>Loading linked account data...</div>
            ) : candidates.length === 0 ? (
              <div className={cx('vm-delete-vm-modal-empty')}>No VMs found on selected node.</div>
            ) : (
              <>
                <div className={cx('vm-delete-vm-modal-list-head')}>
                  <span>VM profile and decision</span>
                  <span>State</span>
                </div>
                {candidates.map((candidate) => {
                  return (
                    <DeleteVmCandidateItem
                      key={candidate.vm.vmid}
                      candidate={candidate}
                      queuedDeleteVmIds={queuedDeleteVmIds}
                      selection={selection}
                      onToggleSelection={onToggleSelection}
                      cx={cx}
                    />
                  );
                })}
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
