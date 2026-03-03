import type React from 'react';
import { AppCheckbox as Checkbox, AppTag as Tag } from '../../../shared/ui';
import type { DeleteVmCandidateRow } from '../model/deleteVm.types';

export const DeleteVmCandidateItem: React.FC<{
  candidate: DeleteVmCandidateRow;
  queuedDeleteVmIds: Set<number>;
  selection: number[];
  onToggleSelection: (vmid: number, checked: boolean) => void;
  cx: (classNames: string) => string;
}> = ({ candidate, queuedDeleteVmIds, selection, onToggleSelection, cx }) => {
  const { vm, canDelete, decisionReason, decisionReasonCode, decisionReasons } = candidate;
  const queuedAlready = queuedDeleteVmIds.has(vm.vmid);
  const checked = selection.includes(vm.vmid);
  const disabled = queuedAlready || !canDelete;
  const vmStatus = String(vm.status || 'unknown').toLowerCase();
  const statusClass =
    vmStatus === 'running' ? 'is-running' : vmStatus === 'stopped' ? 'is-stopped' : 'is-neutral';
  const decisionLine = queuedAlready ? 'Already queued for deletion' : decisionReason;
  const detailLine = queuedAlready
    ? ''
    : decisionReasons.filter((reason) => reason !== decisionReason).join(' | ');
  const decisionClass = disabled ? 'is-blocked' : 'is-allowed';

  return (
    <div
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
          {decisionReasonCode && (
            <span className={cx('vm-delete-vm-modal-item-sub')}>
              Reason code: {decisionReasonCode}
            </span>
          )}
          <span
            className={`vm-delete-vm-modal-item-sub vm-delete-vm-modal-item-sub--decision vm-delete-vm-modal-item-sub--${decisionClass}`}
          >
            Rule: {decisionLine}
          </span>
          {detailLine && (
            <span className={cx('vm-delete-vm-modal-item-sub')}>Details: {detailLine}</span>
          )}
        </div>
      </Checkbox>
      <div className={cx('vm-delete-vm-modal-item-right')}>
        <Tag className={cx(`vm-delete-vm-status ${statusClass}`)}>{vmStatus.toUpperCase()}</Tag>
        <Tag className={cx(`vm-delete-vm-status ${disabled ? 'is-blocked' : 'is-allowed'}`)}>
          {disabled ? 'LOCKED' : 'ALLOWED'}
        </Tag>
        {queuedAlready && <Tag className={cx('vm-delete-vm-status is-queued')}>QUEUED</Tag>}
      </div>
    </div>
  );
};
