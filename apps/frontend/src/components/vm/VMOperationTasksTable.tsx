import type React from 'react';
import type { VMTaskEntry } from '../../types';
import { formatTaskDate, statusLabel } from './vmOperationLogUtils';

interface VMOperationTasksTableProps {
  sortedTasks: VMTaskEntry[];
  taskModalOpen: boolean;
  selectedTaskId?: string;
  onOpenTask: (taskId: string) => void;
  className: (classNames: string) => string;
}

export const VMOperationTasksTable: React.FC<VMOperationTasksTableProps> = ({
  sortedTasks,
  taskModalOpen,
  selectedTaskId,
  onOpenTask,
  className,
}) => {
  return (
    <div className={className('vm-task-console')}>
      <div className={className('vm-task-table-wrap')}>
        <table className={className('vm-task-table')}>
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
                <td colSpan={4} className={className('vm-task-table-empty')}>
                  No tasks yet.
                </td>
              </tr>
            ) : (
              sortedTasks.map((task) => (
                <tr
                  key={task.id}
                  className={className(
                    `vm-task-table-row vm-task-table-row--${task.status}${taskModalOpen && selectedTaskId === task.id ? ' selected' : ''}`,
                  )}
                >
                  <td>{formatTaskDate(task.startedAt)}</td>
                  <td>{formatTaskDate(task.finishedAt)}</td>
                  <td>
                    <button
                      type="button"
                      className={className('vm-task-open-btn')}
                      onClick={() => onOpenTask(task.id)}
                    >
                      {task.description}
                    </button>
                  </td>
                  <td className={className(`vm-task-status vm-task-status--${task.status}`)}>
                    {statusLabel(task.status)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className={className('vm-task-open-hint')}>
        Use the task description button to open a detailed log window.
      </div>
    </div>
  );
};
