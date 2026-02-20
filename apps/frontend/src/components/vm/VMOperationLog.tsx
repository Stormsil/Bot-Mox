import { message, Popconfirm } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { VMTaskEntry } from '../../types';
import coreStyles from './VMOperationLogCore.module.css';
import modalStyles from './VMOperationLogModal.module.css';
import { VMOperationTasksTable } from './VMOperationTasksTable';
import { VMTaskLogModal } from './VMTaskLogModal';
import { getTaskText } from './vmOperationLogUtils';

const styles = { ...coreStyles, ...modalStyles };

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
          <button type="button" disabled={isClearing}>
            Clear
          </button>
        </Popconfirm>
        <button type="button" aria-pressed={expanded} onClick={() => setExpanded((e) => !e)}>
          {expanded ? 'Minimize' : 'Fullscreen'}
        </button>
        <button type="button" onClick={handleCopy}>
          Copy
        </button>
      </div>

      <div className={cx('vm-operation-log-content-shell')}>
        <div className={cx('vm-operation-log-tab-body')}>
          <VMOperationTasksTable
            sortedTasks={sortedTasks}
            taskModalOpen={taskModalOpen}
            selectedTaskId={selectedTask?.id}
            onOpenTask={openTaskModal}
            className={cx}
          />
        </div>
      </div>

      {taskModalOpen && selectedTask && (
        <VMTaskLogModal
          selectedTask={selectedTask}
          onCancelTask={cancelSelectedTask}
          onCopyTaskLog={copyTaskModalLog}
          onClose={closeTaskModal}
          className={cx}
        />
      )}
    </>
  );

  if (expanded) {
    return (
      <>
        <div className={`${cx('vm-operation-log')} vm-operation-log`} style={{ height: 0 }} />
        <div className={cx('vm-log-modal-overlay')}>
          <div
            className={cx('vm-log-modal')}
            role="dialog"
            aria-modal="true"
            aria-label="Operation Console"
          >
            {logContent}
          </div>
        </div>
      </>
    );
  }

  return <div className={`${cx('vm-operation-log')} vm-operation-log`}>{logContent}</div>;
};
