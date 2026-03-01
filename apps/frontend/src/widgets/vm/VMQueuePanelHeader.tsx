import type React from 'react';

interface VMQueuePanelHeaderProps {
  className: (classNames: string) => string;
  isProcessing: boolean;
  isStartActionRunning: boolean;
  canStartAll: boolean;
  onStartAll?: () => void;
  onAddDelete?: () => void;
  onAdd: () => void;
  onClear: () => void;
}

export const VMQueuePanelHeader: React.FC<VMQueuePanelHeaderProps> = ({
  className,
  isProcessing,
  isStartActionRunning,
  canStartAll,
  onStartAll,
  onAddDelete,
  onAdd,
  onClear,
}) => {
  return (
    <div className={className('vm-queue-panel-header')}>
      <div className={className('vm-queue-panel-header-main')}>
        <span className={className('vm-queue-panel-header-title')}>VM Queue</span>
      </div>
      <div className={className('vm-queue-panel-header-actions')}>
        <button
          type="button"
          className={className('vm-queue-panel-start-all')}
          onClick={onStartAll}
          disabled={isProcessing || isStartActionRunning || !canStartAll || !onStartAll}
        >
          {isStartActionRunning ? 'Starting...' : 'Start all'}
        </button>
        <button type="button" onClick={onAddDelete} disabled={isProcessing || !onAddDelete}>
          Delete VM
        </button>
        <button type="button" onClick={onAdd} disabled={isProcessing}>
          + VM
        </button>
        <button type="button" onClick={onClear} disabled={isProcessing || isStartActionRunning}>
          Clear
        </button>
      </div>
    </div>
  );
};
