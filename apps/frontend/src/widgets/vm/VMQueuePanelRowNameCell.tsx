import type React from 'react';
import { useVMQueueContext } from '../../features/vm-queue/model/VMQueueContext';
import type { VMQueueItem } from '../../types';

interface VMQueuePanelRowNameCellProps {
  item: VMQueueItem;
  isDeleteAction: boolean;
  hasDeleteTargetVmId: boolean;
  deleteTargetVmId: number;
  editableCreate: boolean;
}

export const VMQueuePanelRowNameCell: React.FC<VMQueuePanelRowNameCellProps> = ({
  item,
  isDeleteAction,
  hasDeleteTargetVmId,
  deleteTargetVmId,
  editableCreate,
}) => {
  const { onUpdate, className } = useVMQueueContext();
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
