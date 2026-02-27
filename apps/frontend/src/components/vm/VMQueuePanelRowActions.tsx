import type React from 'react';
import { useVMQueueContext } from '../../features/vm-queue/model/VMQueueContext';

interface VMQueuePanelRowActionsProps {
  canStartItem: boolean;
  isItemStarting: boolean;
  vmId?: number;
  itemId: string;
  statusText: string;
  statusTone: string;
  canRemove: boolean;
}

export const VMQueuePanelRowActions: React.FC<VMQueuePanelRowActionsProps> = ({
  canStartItem,
  isItemStarting,
  vmId,
  itemId,
  statusText,
  statusTone,
  canRemove,
}) => {
  const { isProcessing, isStartActionRunning, onStartOne, onRemove, className } =
    useVMQueueContext();
  return (
    <>
      {canStartItem ? (
        <button
          type="button"
          className={className('vm-queue-item-start')}
          onClick={() => onStartOne?.(itemId)}
          disabled={isProcessing || isStartActionRunning}
          title={vmId ? `Start VM ${vmId}` : 'Start VM'}
        >
          {isItemStarting ? 'STARTING' : 'START'}
        </button>
      ) : (
        <span className={className(`vm-queue-item-status vm-queue-item-status--${statusTone}`)}>
          {statusText.toUpperCase()}
        </span>
      )}

      <button
        type="button"
        className={className('vm-queue-item-remove')}
        onClick={() => onRemove(itemId)}
        disabled={!canRemove}
        title="Remove"
      >
        ×
      </button>
    </>
  );
};
