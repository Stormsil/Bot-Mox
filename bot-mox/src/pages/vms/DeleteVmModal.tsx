import React from 'react';
import { Button, Checkbox, Modal, Popover, Tag } from 'antd';
import { DownOutlined, FilterOutlined } from '@ant-design/icons';
import type { DeleteVmCandidateRow, DeleteVmFilters } from './deleteVmRules';
import styles from './VMsPage.module.css';

function cx(classNames: string): string {
  return classNames
    .split(' ')
    .filter(Boolean)
    .map((name) => styles[name] || name)
    .join(' ');
}

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

  const deleteRulesPopoverContent = (
    <div className={cx('vm-delete-vm-filter-popover')}>
      <div className={cx('vm-delete-vm-filter-popover-title')}>Delete rules</div>
      <div className={cx('vm-delete-vm-filter-popover-options')}>
        <Checkbox
          className={cx('vm-delete-vm-filter-option')}
          checked={filters.policy.allowBanned}
          disabled={filtersSaving}
          onChange={(event) => onPolicyToggle('allowBanned', event.target.checked)}
        >
          Allow BANNED
        </Checkbox>
        <Checkbox
          className={cx('vm-delete-vm-filter-option')}
          checked={filters.policy.allowPrepareNoResources}
          disabled={filtersSaving}
          onChange={(event) => onPolicyToggle('allowPrepareNoResources', event.target.checked)}
        >
          Allow PREPARE without resources
        </Checkbox>
        <Checkbox
          className={cx('vm-delete-vm-filter-option')}
          checked={filters.policy.allowOrphan}
          disabled={filtersSaving}
          onChange={(event) => onPolicyToggle('allowOrphan', event.target.checked)}
        >
          Allow orphan VM (no linked account)
        </Checkbox>
      </div>
    </div>
  );

  const viewFiltersPopoverContent = (
    <div className={cx('vm-delete-vm-filter-popover')}>
      <div className={cx('vm-delete-vm-filter-popover-title')}>View filters</div>
      <div className={cx('vm-delete-vm-filter-popover-options')}>
        <Checkbox
          className={cx('vm-delete-vm-filter-option')}
          checked={filters.view.showAllowed}
          disabled={filtersSaving}
          onChange={(event) => onViewToggle('showAllowed', event.target.checked)}
        >
          Show ALLOWED
        </Checkbox>
        <Checkbox
          className={cx('vm-delete-vm-filter-option')}
          checked={filters.view.showLocked}
          disabled={filtersSaving}
          onChange={(event) => onViewToggle('showLocked', event.target.checked)}
        >
          Show LOCKED
        </Checkbox>
        <Checkbox
          className={cx('vm-delete-vm-filter-option')}
          checked={filters.view.showRunning}
          disabled={filtersSaving}
          onChange={(event) => onViewToggle('showRunning', event.target.checked)}
        >
          Show RUNNING
        </Checkbox>
        <Checkbox
          className={cx('vm-delete-vm-filter-option')}
          checked={filters.view.showStopped}
          disabled={filtersSaving}
          onChange={(event) => onViewToggle('showStopped', event.target.checked)}
        >
          Show STOPPED
        </Checkbox>
      </div>
    </div>
  );

  return (
    <Modal
      title={(
        <div className={cx('vm-delete-vm-modal-title-wrap')}>
          <span className={cx('vm-delete-vm-modal-title-main')}>Delete Existing VMs</span>
          <span className={cx('vm-delete-vm-modal-title-sub')}>
            Select VMs marked as ALLOWED and add them to delete queue tasks.
          </span>
        </div>
      )}
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
              content={deleteRulesPopoverContent}
              trigger="click"
              placement="bottomLeft"
              overlayClassName={cx('vm-delete-vm-filter-popover-overlay')}
              overlayInnerStyle={popoverInnerStyle}
            >
              <Button size="small" className={cx('vm-delete-vm-filter-trigger')} icon={<FilterOutlined />}>
                Delete rules
                <span className={cx('vm-delete-vm-filter-trigger-count')}>{policyEnabledCount}/3</span>
                <DownOutlined />
              </Button>
            </Popover>
            <Popover
              content={viewFiltersPopoverContent}
              trigger="click"
              placement="bottomLeft"
              overlayClassName={cx('vm-delete-vm-filter-popover-overlay')}
              overlayInnerStyle={popoverInnerStyle}
            >
              <Button size="small" className={cx('vm-delete-vm-filter-trigger')} icon={<FilterOutlined />}>
                View
                <span className={cx('vm-delete-vm-filter-trigger-count')}>{viewEnabledCount}/4</span>
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
            <div className={cx('vm-delete-vm-list-shell-note')}>Only rows marked <strong>ALLOWED</strong> can be queued</div>
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
                  const { vm, linkedBots, evaluations, canDelete, decisionReason } = candidate;
                  const queuedAlready = queuedDeleteVmIds.has(vm.vmid);
                  const checked = selection.includes(vm.vmid);
                  const disabled = queuedAlready || !canDelete;
                  const vmStatus = String(vm.status || 'unknown').toLowerCase();
                  const statusClass =
                    vmStatus === 'running'
                      ? 'is-running'
                      : vmStatus === 'stopped'
                        ? 'is-stopped'
                        : 'is-neutral';
                  const primary = evaluations[0];
                  const primaryBotId = primary?.bot.id ? primary.bot.id.slice(0, 8) : '';
                  const missingResources = primary
                    ? [
                      !primary.hasEmail ? 'email' : null,
                      !primary.hasPassword ? 'password' : null,
                      !primary.hasProxy ? 'proxy' : null,
                      !primary.hasSubscription ? 'subscription' : null,
                      !primary.hasLicense ? 'license' : null,
                    ].filter((value): value is string => Boolean(value))
                    : [];
                  const accountLine = primary
                    ? `Account ${primaryBotId} • ${String(primary.bot.status || 'unknown').toUpperCase()}${primary.isBanned ? ' • BANNED' : ''}${primary.isPrepareSeed ? ' • PREPARE' : ''}`
                    : 'Account: not linked';
                  const resourcesLine = primary
                    ? (missingResources.length === 0
                      ? 'Resources: complete profile'
                      : `Missing resources: ${missingResources.join(', ')}`)
                    : 'Resources: unavailable (no linked account)';
                  const decisionLine = queuedAlready
                    ? 'Already queued for deletion'
                    : decisionReason;
                  const decisionClass = disabled ? 'is-blocked' : 'is-allowed';
                  return (
                    <div
                      key={vm.vmid}
                      className={`vm-delete-vm-modal-item ${canDelete ? 'is-allowed' : 'is-blocked'}${checked ? ' is-selected' : ''}${disabled ? ' is-disabled' : ''}`}
                    >
                      <Checkbox
                        className={cx('vm-delete-vm-modal-check')}
                        checked={checked}
                        disabled={disabled}
                        onChange={(event) => onToggleSelection(vm.vmid, event.target.checked)}
                      >
                        <div className={cx('vm-delete-vm-modal-check-content')}>
                          <span className={cx('vm-delete-vm-modal-item-main')}>
                            VM {vm.vmid} - {vm.name || `VM ${vm.vmid}`}
                          </span>
                          <span className={cx('vm-delete-vm-modal-item-sub vm-delete-vm-modal-item-sub--account')}>
                            {accountLine}
                          </span>
                          <span className={cx('vm-delete-vm-modal-item-sub vm-delete-vm-modal-item-sub--resources')}>
                            {resourcesLine}
                          </span>
                          {linkedBots.length > 1 && (
                            <span className={cx('vm-delete-vm-modal-item-sub')}>
                              Linked accounts: {linkedBots.length}
                            </span>
                          )}
                          <span className={`vm-delete-vm-modal-item-sub vm-delete-vm-modal-item-sub--decision vm-delete-vm-modal-item-sub--${decisionClass}`}>
                            Rule: {decisionLine}
                          </span>
                        </div>
                      </Checkbox>
                      <div className={cx('vm-delete-vm-modal-item-right')}>
                        <Tag className={cx(`vm-delete-vm-status ${statusClass}`)}>{vmStatus.toUpperCase()}</Tag>
                        <Tag className={cx(`vm-delete-vm-status ${disabled ? 'is-blocked' : 'is-allowed'}`)}>
                          {disabled ? 'LOCKED' : 'ALLOWED'}
                        </Tag>
                        {queuedAlready && (
                          <Tag className={cx('vm-delete-vm-status is-queued')}>QUEUED</Tag>
                        )}
                      </div>
                    </div>
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
