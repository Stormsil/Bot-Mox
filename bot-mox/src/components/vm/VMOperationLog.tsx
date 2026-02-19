import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  VMTaskDetailEntry,
  VMTaskEntry,
  VMTaskStatus,
} from '../../types';
import { Popconfirm, message } from 'antd';
import styles from './VMOperationLog.module.css';

const cx = (...classNames: Array<string | false | null | undefined>) =>
  classNames
    .flatMap((name) => String(name || '').split(/\s+/))
    .filter(Boolean)
    .map((name) => styles[name] || name)
    .join(' ');

interface VMOperationLogProps {
  tasks: VMTaskEntry[];
  onClear: () => void | Promise<void>;
  onCancelTask: (taskId: string) => void;
  getFullLog: () => string;
}

function formatClock(ts: number): string {
  return new Date(ts).toLocaleTimeString();
}

function formatTaskDate(ts?: number): string {
  if (!ts) return '-';
  return new Date(ts)
    .toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
    .replace(',', '');
}

function statusLabel(status: VMTaskStatus): string {
  switch (status) {
    case 'ok':
      return 'OK';
    case 'error':
      return 'Error';
    case 'cancelled':
      return 'Cancelled';
    default:
      return 'Running';
  }
}

function formatTaskDetailLine(entry: VMTaskDetailEntry): string {
  const levelPrefix = entry.level === 'info' ? '' : ` ${entry.level.toUpperCase()}:`;
  return `[${formatClock(entry.timestamp)}]${levelPrefix} ${entry.message}`;
}

function splitDiffMessage(message: string): {
  prefix: string;
  oldValue: string;
  newValue: string;
} | null {
  const arrowIndex = message.indexOf('->');
  if (arrowIndex <= 0) return null;

  const left = message.slice(0, arrowIndex).trimEnd();
  const right = message.slice(arrowIndex + 2).trimStart();
  if (!left || !right) return null;

  const fieldMatch = left.match(/^(\s*[^:]+:\s*)([\s\S]*)$/);
  if (fieldMatch) {
    return {
      prefix: fieldMatch[1],
      oldValue: fieldMatch[2] || '(empty)',
      newValue: right || '(empty)',
    };
  }

  return {
    prefix: '',
    oldValue: left,
    newValue: right,
  };
}

function getTaskText(task: VMTaskEntry): string {
  const head = [
    `Description: ${task.description}`,
    `Node: ${task.node}`,
    `User: ${task.userName}`,
    `Status: ${statusLabel(task.status)}`,
    `Start: ${formatTaskDate(task.startedAt)}`,
    `End: ${formatTaskDate(task.finishedAt)}`,
  ].join('\n');

  const details = task.details.map(formatTaskDetailLine).join('\n');

  return `${head}\n\n${details}`;
}

export const VMOperationLog: React.FC<VMOperationLogProps> = ({
  tasks,
  onClear,
  onCancelTask,
  getFullLog,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const sortedTasks = useMemo(() => [...tasks].sort((a, b) => b.startedAt - a.startedAt), [tasks]);

  const selectedTask = useMemo(
    () => sortedTasks.find((task) => task.id === selectedTaskId) || sortedTasks[0],
    [sortedTasks, selectedTaskId],
  );

  const handleCopy = () => {
    const text = selectedTask ? getTaskText(selectedTask) : getFullLog();
    if (!text.trim()) {
      message.warning('No logs to copy');
      return;
    }
    navigator.clipboard.writeText(text);
    message.success(selectedTask ? 'Task log copied' : 'Log copied');
  };

  const toolbarStat = `${sortedTasks.length} task${sortedTasks.length === 1 ? '' : 's'}`;

  const openTaskModal = (taskId: string) => {
    setSelectedTaskId(taskId);
    setTaskModalOpen(true);
  };

  const closeTaskModal = useCallback(() => {
    setTaskModalOpen(false);
  }, []);

  const closeExpanded = useCallback(() => {
    setExpanded(false);
  }, []);

  useEffect(() => {
    if (!taskModalOpen && !expanded) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }

      event.preventDefault();

      if (taskModalOpen) {
        closeTaskModal();
        return;
      }

      if (expanded) {
        closeExpanded();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [taskModalOpen, expanded, closeTaskModal, closeExpanded]);

  const copyTaskModalLog = () => {
    if (!selectedTask) return;
    navigator.clipboard.writeText(getTaskText(selectedTask));
    message.success('Task log copied');
  };

  const cancelSelectedTask = () => {
    if (!selectedTask || selectedTask.status !== 'running') {
      return;
    }
    onCancelTask(selectedTask.id);
    message.info('Cancellation requested');
  };

  const handleClear = async () => {
    try {
      setIsClearing(true);
      await onClear();
      setTaskModalOpen(false);
      message.success('Operation history cleared');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to clear operation history';
      message.error(errorMessage);
    } finally {
      setIsClearing(false);
    }
  };

  const renderTaskDetailMessage = (entry: VMTaskDetailEntry) => {
    const parsedDiff = splitDiffMessage(entry.message);
    if (!parsedDiff) {
      return <span className={cx('vm-task-log-message')}>{entry.message}</span>;
    }

    return (
      <span className={cx('vm-task-log-message')}>
        {parsedDiff.prefix && (
          <span className={cx('vm-task-log-diff-prefix')}>{parsedDiff.prefix}</span>
        )}
        <span className={cx('vm-task-log-diff-old')}>{parsedDiff.oldValue}</span>
        <span className={cx('vm-task-log-diff-arrow')}> -&gt; </span>
        <span className={cx('vm-task-log-diff-new')}>{parsedDiff.newValue}</span>
      </span>
    );
  };

  const tasksView = (
    <div className={cx('vm-task-console')}>
      <div className={cx('vm-task-table-wrap')}>
        <table className={cx('vm-task-table')}>
          <thead>
            <tr>
              <th>Start Time</th>
              <th>End Time</th>
              <th>Description</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {sortedTasks.length === 0 ? (
              <tr>
                <td colSpan={4} className={cx('vm-task-table-empty')}>
                  No tasks yet.
                </td>
              </tr>
            ) : (
              sortedTasks.map((task) => (
                <tr
                  key={task.id}
                  className={cx(
                    'vm-task-table-row',
                    `vm-task-table-row--${task.status}`,
                    taskModalOpen && selectedTask?.id === task.id ? 'selected' : '',
                  )}
                >
                  <td>{formatTaskDate(task.startedAt)}</td>
                  <td>{formatTaskDate(task.finishedAt)}</td>
                  <td>
                    <button
                      type="button"
                      className={cx('vm-task-open-btn')}
                      onClick={() => openTaskModal(task.id)}
                    >
                      {task.description}
                    </button>
                  </td>
                  <td className={cx('vm-task-status', `vm-task-status--${task.status}`)}>
                    {statusLabel(task.status)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className={cx('vm-task-open-hint')}>Use the task description button to open a detailed log window.</div>
    </div>
  );

  const logContent = (
    <>
      <div className={cx('vm-operation-log-toolbar')}>
        <span className={cx('vm-operation-log-toolbar-title')}>Operation Console</span>
        <span className={cx('vm-operation-log-toolbar-stat')}>{toolbarStat}</span>
        <Popconfirm
          title="Clear operation history?"
          description="This will permanently delete task history from the database."
          okText="Clear"
          cancelText="Cancel"
          okButtonProps={{ danger: true, loading: isClearing }}
          placement="top"
          onConfirm={() => void handleClear()}
        >
          <button type="button" disabled={isClearing}>Clear</button>
        </Popconfirm>
        <button
          type="button"
          aria-pressed={expanded}
          onClick={() => setExpanded(e => !e)}
        >
          {expanded ? 'Minimize' : 'Fullscreen'}
        </button>
        <button type="button" onClick={handleCopy}>Copy</button>
      </div>

      <div className={cx('vm-operation-log-content-shell')}>
        <div className={cx('vm-operation-log-tab-body')}>{tasksView}</div>
      </div>

      {taskModalOpen && selectedTask && (
        <div className={cx('vm-task-log-modal-overlay')} onClick={closeTaskModal}>
          <div
            className={cx('vm-task-log-modal')}
            role="dialog"
            aria-modal="true"
            aria-labelledby="vm-task-log-modal-title"
            onClick={e => e.stopPropagation()}
          >
            <div className={cx('vm-task-log-modal-header')}>
              <div className={cx('vm-task-log-modal-title')} id="vm-task-log-modal-title">Task Viewer</div>
              <div className={cx('vm-task-log-modal-actions')}>
                {selectedTask.status === 'running' && (
                  <Popconfirm
                    title="Cancel this running task?"
                    description="The task will be marked as cancelled."
                    okText="Cancel Task"
                    cancelText="Back"
                    okButtonProps={{ danger: true }}
                    placement="bottomRight"
                    onConfirm={cancelSelectedTask}
                  >
                    <button type="button" className={cx('vm-task-log-modal-cancel-btn')}>
                      Cancel Task
                    </button>
                  </Popconfirm>
                )}
                <button type="button" onClick={copyTaskModalLog}>
                  Copy
                </button>
                <button type="button" onClick={closeTaskModal}>
                  OK
                </button>
              </div>
            </div>

            <div className={cx('vm-task-log-modal-meta')}>
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

            <div className={cx('vm-task-log-modal-content')}>
              {selectedTask.details.length === 0 ? (
                <div className={cx('vm-task-log-empty')}>No details for this task yet.</div>
              ) : (
                <div className={cx('vm-task-log-modal-pre')}>
                  {selectedTask.details.map((entry) => (
                    <div
                      key={entry.id}
                      className={cx('vm-task-log-line', `vm-task-log-line--${entry.level}`)}
                    >
                      <span className={cx('vm-task-log-time')}>
                        [{formatClock(entry.timestamp)}]
                      </span>
                      {entry.level !== 'info' && (
                        <span className={cx('vm-task-log-level')}>
                          {' '}
                          {entry.level.toUpperCase()}:
                        </span>
                      )}
                      <span className={cx('vm-task-log-gap')}> </span>
                      {renderTaskDetailMessage(entry)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (expanded) {
    return (
      <>
        <div className={`${cx('vm-operation-log')} vm-operation-log`} style={{ height: 0 }} />
        <div className={cx('vm-log-modal-overlay')} onClick={closeExpanded}>
          <div
            className={cx('vm-log-modal')}
            role="dialog"
            aria-modal="true"
            aria-label="Operation Console"
            onClick={e => e.stopPropagation()}
          >
            {logContent}
          </div>
        </div>
      </>
    );
  }

  return <div className={`${cx('vm-operation-log')} vm-operation-log`}>{logContent}</div>;
};
