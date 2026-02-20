import { Checkbox, Tag } from 'antd';
import type React from 'react';
import type { DeleteVmCandidateRow } from '../deleteVmRules';

export const DeleteVmCandidateItem: React.FC<{
  candidate: DeleteVmCandidateRow;
  queuedDeleteVmIds: Set<number>;
  selection: number[];
  onToggleSelection: (vmid: number, checked: boolean) => void;
  cx: (classNames: string) => string;
}> = ({ candidate, queuedDeleteVmIds, selection, onToggleSelection, cx }) => {
  const { vm, linkedBots, evaluations, canDelete, decisionReason } = candidate;
  const queuedAlready = queuedDeleteVmIds.has(vm.vmid);
  const checked = selection.includes(vm.vmid);
  const disabled = queuedAlready || !canDelete;
  const vmStatus = String(vm.status || 'unknown').toLowerCase();
  const statusClass =
    vmStatus === 'running' ? 'is-running' : vmStatus === 'stopped' ? 'is-stopped' : 'is-neutral';
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
    ? missingResources.length === 0
      ? 'Resources: complete profile'
      : `Missing resources: ${missingResources.join(', ')}`
    : 'Resources: unavailable (no linked account)';
  const decisionLine = queuedAlready ? 'Already queued for deletion' : decisionReason;
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
          <span className={cx('vm-delete-vm-modal-item-sub vm-delete-vm-modal-item-sub--account')}>
            {accountLine}
          </span>
          <span
            className={cx('vm-delete-vm-modal-item-sub vm-delete-vm-modal-item-sub--resources')}
          >
            {resourcesLine}
          </span>
          {linkedBots.length > 1 && (
            <span className={cx('vm-delete-vm-modal-item-sub')}>
              Linked accounts: {linkedBots.length}
            </span>
          )}
          <span
            className={`vm-delete-vm-modal-item-sub vm-delete-vm-modal-item-sub--decision vm-delete-vm-modal-item-sub--${decisionClass}`}
          >
            Rule: {decisionLine}
          </span>
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
