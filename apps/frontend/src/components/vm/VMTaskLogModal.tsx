import { Popconfirm } from 'antd';
import type React from 'react';
import type { VMTaskDetailEntry, VMTaskEntry } from '../../types';
import { formatClock, formatTaskDate, splitDiffMessage, statusLabel } from './vmOperationLogUtils';

interface VMTaskLogModalProps {
  selectedTask: VMTaskEntry;
  onCancelTask: (taskId: string) => void;
  onCopyTaskLog: () => void;
  onClose: () => void;
  className: (classNames: string) => string;
}

function renderTaskDetailMessage(
  entry: VMTaskDetailEntry,
  className: (classNames: string) => string,
): React.ReactNode {
  const parsedDiff = splitDiffMessage(entry.message);
  if (!parsedDiff) {
    return <span className={className('vm-task-log-message')}>{entry.message}</span>;
  }

  return (
    <span className={className('vm-task-log-message')}>
      {parsedDiff.prefix && (
        <span className={className('vm-task-log-diff-prefix')}>{parsedDiff.prefix}</span>
      )}
      <span className={className('vm-task-log-diff-old')}>{parsedDiff.oldValue}</span>
      <span className={className('vm-task-log-diff-arrow')}> -&gt; </span>
      <span className={className('vm-task-log-diff-new')}>{parsedDiff.newValue}</span>
    </span>
  );
}

export const VMTaskLogModal: React.FC<VMTaskLogModalProps> = ({
  selectedTask,
  onCancelTask,
  onCopyTaskLog,
  onClose,
  className,
}) => {
  return (
    <div className={className('vm-task-log-modal-overlay')}>
      <div
        className={className('vm-task-log-modal')}
        role="dialog"
        aria-modal="true"
        aria-labelledby="vm-task-log-modal-title"
      >
        <div className={className('vm-task-log-modal-header')}>
          <div className={className('vm-task-log-modal-title')} id="vm-task-log-modal-title">
            Task Viewer
          </div>
          <div className={className('vm-task-log-modal-actions')}>
            {selectedTask.status === 'running' && (
              <Popconfirm
                title="Cancel this running task?"
                description="The task will be marked as cancelled."
                okText="Cancel Task"
                cancelText="Back"
                okButtonProps={{ danger: true }}
                placement="bottomRight"
                onConfirm={() => onCancelTask(selectedTask.id)}
              >
                <button type="button" className={className('vm-task-log-modal-cancel-btn')}>
                  Cancel Task
                </button>
              </Popconfirm>
            )}
            <button type="button" onClick={onCopyTaskLog}>
              Copy
            </button>
            <button type="button" onClick={onClose}>
              OK
            </button>
          </div>
        </div>

        <div className={className('vm-task-log-modal-meta')}>
          <span>
            <strong>Description:</strong> {selectedTask.description}
          </span>
          <span>
            <strong>Node:</strong> {selectedTask.node || '-'}
          </span>
          <span>
            <strong>User:</strong> {selectedTask.userName || '-'}
          </span>
          <span>
            <strong>Start:</strong> {formatTaskDate(selectedTask.startedAt)}
          </span>
          <span>
            <strong>End:</strong> {formatTaskDate(selectedTask.finishedAt)}
          </span>
          <span>
            <strong>Status:</strong> {statusLabel(selectedTask.status)}
          </span>
        </div>

        <div className={className('vm-task-log-modal-content')}>
          {selectedTask.details.length === 0 ? (
            <div className={className('vm-task-log-empty')}>No details for this task yet.</div>
          ) : (
            <div className={className('vm-task-log-modal-pre')}>
              {selectedTask.details.map((entry) => (
                <div
                  key={entry.id}
                  className={className(`vm-task-log-line vm-task-log-line--${entry.level}`)}
                >
                  <span className={className('vm-task-log-time')}>
                    [{formatClock(entry.timestamp)}]
                  </span>
                  {entry.level !== 'info' && (
                    <span className={className('vm-task-log-level')}>
                      {' '}
                      {entry.level.toUpperCase()}:
                    </span>
                  )}
                  <span className={className('vm-task-log-gap')}> </span>
                  {renderTaskDetailMessage(entry, className)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
