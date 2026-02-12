import React from 'react';
import { Button, Switch, Empty } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ScheduleSession } from '../../types';
import { formatDuration, timeToMinutes } from '../../utils/scheduleUtils';
import { TableActionButton } from '../ui/TableActionButton';
import './SessionList.css';

interface SessionListProps {
  sessions: ScheduleSession[];
  onAdd: () => void;
  onEdit: (session: ScheduleSession) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
}

export const SessionList: React.FC<SessionListProps> = ({
  sessions,
  onAdd,
  onEdit,
  onDelete,
  onToggle
}) => {
  // Ensure sessions is an array
  const sessionsArray = Array.isArray(sessions) ? sessions : [];

  // Sort sessions by start time
  const sortedSessions = [...sessionsArray].sort(
    (a, b) => timeToMinutes(a.start) - timeToMinutes(b.start)
  );

  const getSessionDuration = (session: ScheduleSession): string => {
    const startMin = timeToMinutes(session.start);
    const endMin = timeToMinutes(session.end);
    // Учитываем переход через полночь
    const minutes = endMin < startMin 
      ? (1440 - startMin) + endMin 
      : endMin - startMin;
    return formatDuration(minutes);
  };

  return (
    <div className="session-list">
      <div className="session-list-header">
        <h4>Sessions</h4>
        <Button
          type="primary"
          size="small"
          icon={<PlusOutlined />}
          onClick={onAdd}
        >
          Add Session
        </Button>
      </div>

      {sortedSessions.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No sessions for this day"
          className="session-empty"
        />
      ) : (
        <div className="session-items-scrollable">
          <div className="session-items">
            {sortedSessions.map((session, index) => (
              <div
                key={session.id}
                className={`session-item ${!session.enabled ? 'disabled' : ''}`}
              >
                <div className="session-number">{index + 1}</div>

                <div className="session-time">
                  <span className="time-range">
                    {session.start} - {session.end}
                  </span>
                  <span className="duration">
                    ({getSessionDuration(session)})
                  </span>
                </div>

                <div className="session-actions">
                  <Switch
                    size="small"
                    checked={session.enabled}
                    onChange={(checked) => onToggle(session.id, checked)}
                  />
                  <TableActionButton
                    icon={<EditOutlined />}
                    onClick={() => onEdit(session)}
                    tooltip="Edit session"
                  />
                  <TableActionButton
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
