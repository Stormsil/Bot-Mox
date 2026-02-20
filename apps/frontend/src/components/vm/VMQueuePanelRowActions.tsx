import type React from 'react';

interface VMQueuePanelRowActionsProps {
  canStartItem: boolean;
  isItemStarting: boolean;
  isProcessing: boolean;
  isStartActionRunning: boolean;
  vmId?: number;
  itemId: string;
  statusText: string;
  statusTone: string;
  canRemove: boolean;
  onStartOne?: (id: string) => void;
  onRemove: (id: string) => void;
  className: (classNames: string) => string;
}

export const VMQueuePanelRowActions: React.FC<VMQueuePanelRowActionsProps> = ({
  canStartItem,
  isItemStarting,
  isProcessing,
  isStartActionRunning,
  vmId,
  itemId,
  statusText,
  statusTone,
  canRemove,
  onStartOne,
  onRemove,
  className,
}) => {
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
