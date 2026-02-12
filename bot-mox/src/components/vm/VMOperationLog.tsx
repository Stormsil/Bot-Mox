import React, { useMemo, useState } from 'react';
import type {
  VMTaskDetailEntry,
  VMTaskEntry,
  VMTaskStatus,
} from '../../types';
import { message } from 'antd';
import './VMOperationLog.css';

interface VMOperationLogProps {
  tasks: VMTaskEntry[];
  onClear: () => void;
  getFullLog: () => string;
}

function formatClock(ts: number): string {
  return new Date(ts).toLocaleTimeString();
}

function formatTaskDate(ts?: number): string {
  if (!ts) return '-';
  return new Date(ts).toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).replace(',', '');
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

  const details = task.details
    .map(formatTaskDetailLine)
    .join('\n');

  return `${head}\n\n${details}`;
}

export const VMOperationLog: React.FC<VMOperationLogProps> = ({ tasks, onClear, getFullLog }) => {
  const [expanded, setExpanded] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [taskModalOpen, setTaskModalOpen] = useState(false);

  const sortedTasks = useMemo(
    () => [...tasks].sort((a, b) => b.startedAt - a.startedAt),
    [tasks]
  );

  const selectedTask = useMemo(
    () => sortedTasks.find(task => task.id === selectedTaskId) || sortedTasks[0],
    [sortedTasks, selectedTaskId]
  );

  const handleCopy = () => {
    const text = selectedTask
      ? getTaskText(selectedTask)
      : getFullLog();
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

  const closeTaskModal = () => {
    setTaskModalOpen(false);
  };

  const copyTaskModalLog = () => {
    if (!selectedTask) return;
    navigator.clipboard.writeText(getTaskText(selectedTask));
    message.success('Task log copied');
  };

  const renderTaskDetailMessage = (entry: VMTaskDetailEntry) => {
    const parsedDiff = splitDiffMessage(entry.message);
    if (!parsedDiff) {
      return (
        <span className="vm-task-log-message">
          {entry.message}
        </span>
      );
    }

    return (
      <span className="vm-task-log-message">
        {parsedDiff.prefix && (
          <span className="vm-task-log-diff-prefix">{parsedDiff.prefix}</span>
        )}
        <span className="vm-task-log-diff-old">{parsedDiff.oldValue}</span>
        <span className="vm-task-log-diff-arrow"> -&gt; </span>
        <span className="vm-task-log-diff-new">{parsedDiff.newValue}</span>
      </span>
    );
  };

  const tasksView = (
    <div className="vm-task-console">
      <div className="vm-task-table-wrap">
        <table className="vm-task-table">
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
                <td colSpan={4} className="vm-task-table-empty">No tasks yet.</td>
              </tr>
            ) : (
              sortedTasks.map((task) => (
                <tr
                  key={task.id}
                  className={[
                    'vm-task-table-row',
                    `vm-task-table-row--${task.status}`,
                    taskModalOpen && selectedTask?.id === task.id ? 'selected' : '',
                  ].join(' ')}
                  onClick={() => openTaskModal(task.id)}
                >
                  <td>{formatTaskDate(task.startedAt)}</td>
                  <td>{formatTaskDate(task.finishedAt)}</td>
                  <td>{task.description}</td>
                  <td className={`vm-task-status vm-task-status--${task.status}`}>
                    {statusLabel(task.status)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="vm-task-open-hint">Click a task to open a detailed log window.</div>
    </div>
  );

  const logContent = (
    <>
      <div className="vm-operation-log-toolbar">
        <span className="vm-operation-log-toolbar-title">Operation Console</span>
        <span className="vm-operation-log-toolbar-stat">{toolbarStat}</span>
        <button onClick={onClear}>Clear</button>
        <button onClick={() => setExpanded(e => !e)}>{expanded ? 'Minimize' : 'Fullscreen'}</button>
        <button onClick={handleCopy}>Copy</button>
      </div>

      <div className="vm-operation-log-content-shell">
        <div className="vm-operation-log-tab-body">
          {tasksView}
        </div>
      </div>

      {taskModalOpen && selectedTask && (
        <div className="vm-task-log-modal-overlay" onClick={closeTaskModal}>
          <div className="vm-task-log-modal" onClick={e => e.stopPropagation()}>
            <div className="vm-task-log-modal-header">
              <div className="vm-task-log-modal-title">Task Viewer</div>
              <div className="vm-task-log-modal-actions">
                <button type="button" onClick={copyTaskModalLog}>Copy</button>
                <button type="button" onClick={closeTaskModal}>OK</button>
              </div>
            </div>

            <div className="vm-task-log-modal-meta">
              <span><strong>Description:</strong> {selectedTask.description}</span>
              <span><strong>Node:</strong> {selectedTask.node || '-'}</span>
              <span><strong>User:</strong> {selectedTask.userName || '-'}</span>
              <span><strong>Start:</strong> {formatTaskDate(selectedTask.startedAt)}</span>
              <span><strong>End:</strong> {formatTaskDate(selectedTask.finishedAt)}</span>
              <span><strong>Status:</strong> {statusLabel(selectedTask.status)}</span>
            </div>

            <div className="vm-task-log-modal-content">
              {selectedTask.details.length === 0 ? (
                <div className="vm-task-log-empty">No details for this task yet.</div>
              ) : (
                <div className="vm-task-log-modal-pre">
                  {selectedTask.details.map((entry) => (
                    <div key={entry.id} className={`vm-task-log-line vm-task-log-line--${entry.level}`}>
                      <span className="vm-task-log-time">[{formatClock(entry.timestamp)}]</span>
                      {entry.level !== 'info' && (
                        <span className="vm-task-log-level"> {entry.level.toUpperCase()}:</span>
                      )}
                      <span className="vm-task-log-gap"> </span>
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
        <div className="vm-operation-log" style={{ height: 0 }} />
        <div className="vm-log-modal-overlay" onClick={() => setExpanded(false)}>
          <div className="vm-log-modal" onClick={e => e.stopPropagation()}>
            {logContent}
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="vm-operation-log">
      {logContent}
    </div>
  );
};
