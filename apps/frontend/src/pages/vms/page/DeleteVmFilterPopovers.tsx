import { Checkbox } from 'antd';
import type React from 'react';
import type { DeleteVmFilters } from '../deleteVmRules';

export const DeleteRulesPopoverContent: React.FC<{
  filters: DeleteVmFilters;
  filtersSaving: boolean;
  onPolicyToggle: (key: keyof DeleteVmFilters['policy'], value: boolean) => void;
  cx: (classNames: string) => string;
}> = ({ filters, filtersSaving, onPolicyToggle, cx }) => {
  return (
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
};

export const ViewFiltersPopoverContent: React.FC<{
  filters: DeleteVmFilters;
  filtersSaving: boolean;
  onViewToggle: (key: keyof DeleteVmFilters['view'], value: boolean) => void;
  cx: (classNames: string) => string;
}> = ({ filters, filtersSaving, onViewToggle, cx }) => {
  return (
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
};
