import type React from 'react';
import type { VMQueueItem } from '../../types';

interface VMQueuePanelRowNameCellProps {
  item: VMQueueItem;
  isDeleteAction: boolean;
  hasDeleteTargetVmId: boolean;
  deleteTargetVmId: number;
  editableCreate: boolean;
  onUpdate: (id: string, updates: Partial<VMQueueItem>) => void;
  className: (classNames: string) => string;
}

export const VMQueuePanelRowNameCell: React.FC<VMQueuePanelRowNameCellProps> = ({
  item,
  isDeleteAction,
  hasDeleteTargetVmId,
  deleteTargetVmId,
  editableCreate,
  onUpdate,
  className,
}) => {
  const vmInputValue =
    isDeleteAction && hasDeleteTargetVmId ? `${item.name} [ID ${deleteTargetVmId}]` : item.name;

  return (
    <div className={className('vm-queue-item-vm')}>
      <input
        className={className('vm-queue-item-input vm-queue-item-input--name')}
        value={vmInputValue}
        onChange={(event) => {
          if (!isDeleteAction) {
            onUpdate(item.id, { name: event.target.value });
          }
        }}
        disabled={!editableCreate}
        placeholder="VM name"
      />
    </div>
  );
};
