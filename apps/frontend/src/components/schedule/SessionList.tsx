import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Empty, Switch } from 'antd';
import type React from 'react';
import type { ScheduleSession } from '../../types';
import { formatDuration, timeToMinutes } from '../../utils/scheduleUtils';
import { TableActionButton } from '../ui/TableActionButton';
import styles from './SessionList.module.css';

interface SessionListProps {
  sessions: ScheduleSession[];
  onAdd: () => void;
  onEdit: (session: ScheduleSession) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
  className?: string;
}

export const SessionList: React.FC<SessionListProps> = ({
  sessions,
  onAdd,
  onEdit,
  onDelete,
  onToggle,
  className,
}) => {
  // Ensure sessions is an array
  const sessionsArray = Array.isArray(sessions) ? sessions : [];

  // Sort sessions by start time
  const sortedSessions = [...sessionsArray].sort(
    (a, b) => timeToMinutes(a.start) - timeToMinutes(b.start),
  );

  const getSessionDuration = (session: ScheduleSession): string => {
    const startMin = timeToMinutes(session.start);
    const endMin = timeToMinutes(session.end);
    // Учитываем переход через полночь
    const minutes = endMin < startMin ? 1440 - startMin + endMin : endMin - startMin;
    return formatDuration(minutes);
  };

  return (
    <div className={[styles['session-list'], className].filter(Boolean).join(' ')}>
      <div className={styles['session-list-header']}>
        <h4>Sessions</h4>
        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={onAdd}>
          Add Session
        </Button>
      </div>

      {sortedSessions.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No sessions for this day"
          className={styles['session-empty']}
        />
      ) : (
        <div className={styles['session-items-scrollable']}>
          <div className={styles['session-items']}>
            {sortedSessions.map((session, index) => (
              <div
                key={session.id}
                className={[styles['session-item'], !session.enabled ? styles.disabled : '']
                  .filter(Boolean)
                  .join(' ')}
              >
                <div className={styles['session-number']}>{index + 1}</div>

                <div className={styles['session-time']}>
                  <span className={styles['time-range']}>
                    {session.start} - {session.end}
                  </span>
                  <span className={styles.duration}>({getSessionDuration(session)})</span>
                </div>

                <div className={styles['session-actions']}>
                  <Switch
                    size="small"
                    checked={session.enabled}
                    onChange={(checked) => onToggle(session.id, checked)}
                    // Ant Switch background is controlled by internal selectors; use inline style
                    // so we don't need any `.ant-*` overrides in CSS Modules.
                    style={{
                      backgroundColor: session.enabled
                        ? 'var(--boxmox-color-status-success)'
                        : 'var(--boxmox-color-border-strong)',
                    }}
                  />
                  <TableActionButton
                    className={styles.sessionActionBtn}
                    icon={<EditOutlined />}
                    onClick={() => onEdit(session)}
                    tooltip="Edit session"
                  />
                  <TableActionButton
                    className={styles.sessionActionBtn}
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => onDelete(session.id)}
                    tooltip="Delete session"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
