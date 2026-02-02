import React from 'react';
import type { ScheduleSession } from '../../types';
import { timeToMinutes, formatDuration } from '../../utils/scheduleUtils';
import './TimelineVisualizer.css';

interface TimelineVisualizerProps {
  sessions: ScheduleSession[];
}

const HOURS = Array.from({ length: 25 }, (_, i) => i); // 0-24

export const TimelineVisualizer: React.FC<TimelineVisualizerProps> = ({
  sessions
}) => {
  // Defensive check: ensure sessions is an array
  const sessionsArray = Array.isArray(sessions) ? sessions : [];
  const sortedSessions = [...sessionsArray]
    .filter(s => s.enabled)
    .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));

  // Вычисляем точные позиции сессий для отрисовки
  const getSessionSegments = () => {
    return sortedSessions.map(session => {
      const startMinutes = timeToMinutes(session.start);
      const endMinutes = timeToMinutes(session.end);
      
      // Учитываем переход через полночь
      let duration: number;
      if (endMinutes < startMinutes) {
        duration = (1440 - startMinutes) + endMinutes;
      } else {
        duration = endMinutes - startMinutes;
      }
      
      return {
        session,
        startMinutes,
        endMinutes,
        duration,
        left: (startMinutes / 1440) * 100,
        width: (duration / 1440) * 100
      };
    });
  };

  const sessionSegments = getSessionSegments();

  if (sortedSessions.length === 0) {
    return (
      <div className="timeline-visualizer">
        <div className="timeline-header">
          <h4 className="timeline-title">Day Timeline</h4>
        </div>
        <div className="timeline-container disabled">
          <div className="timeline-line-container">
            {/* Основная линия */}
            <div className="timeline-base-line" />
            
            {/* Тонкие засечки для каждого часа */}
            {HOURS.map(hour => (
              <div
                key={hour}
                className="timeline-tick"
                style={{ left: `${(hour / 24) * 100}%` }}
              />
            ))}
            
            {/* Метки времени (каждые 2 часа) - под линией */}
            <div className="timeline-labels">
              {HOURS.filter(h => h % 2 === 0).map(hour => (
                <span
                  key={hour}
                  className="timeline-time-label"
                  style={{ left: `${(hour / 24) * 100}%` }}
                >
                  {hour.toString().padStart(2, '0')}:00
                </span>
              ))}
            </div>
          </div>
          <div className="timeline-overlay">
            <span>No Sessions</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="timeline-visualizer">
      <div className="timeline-header">
        <h4 className="timeline-title">Day Timeline</h4>
        <div className="timeline-header-legend">
          <div className="legend-item">
            <div className="legend-bar" />
            <span>Active</span>
          </div>
          <div className="legend-item">
            <div className="legend-line" />
            <span>Offline</span>
          </div>
          <div className="legend-item">
            <div className="legend-marker start" />
            <span>Start</span>
          </div>
          <div className="legend-item">
            <div className="legend-marker end" />
            <span>End</span>
          </div>
        </div>
      </div>

      <div className="timeline-container">
        <div className="timeline-line-container">
          {/* Основная линия (фон) */}
          <div className="timeline-base-line" />
          
          {/* Активные сегменты сессий */}
          {sessionSegments.map((segment) => (
            <div
              key={segment.session.id}
              className="timeline-session-bar"
              style={{
                left: `${segment.left}%`,
                width: `${segment.width}%`
              }}
              title={`${segment.session.start} - ${segment.session.end}${segment.session.profile ? ` (${segment.session.profile})` : ''}`}
            >
              {/* Подпись длительности сессии - только длительность по центру */}
              {segment.width > 2 && (
                <span className="session-duration-label">
                  {formatDuration(segment.duration)}
                </span>
              )}
            </div>
          ))}
          
          {/* Тонкие засечки для каждого часа */}
          {HOURS.map(hour => (
            <div
              key={hour}
              className="timeline-tick"
              style={{ left: `${(hour / 24) * 100}%` }}
            />
          ))}
          
          {/* Метки времени (каждые 2 часа) - под линией */}
          <div className="timeline-labels">
            {HOURS.filter(h => h % 2 === 0).map(hour => (
              <span
                key={hour}
                className="timeline-time-label"
                style={{ left: `${(hour / 24) * 100}%` }}
              >
                {hour.toString().padStart(2, '0')}:00
              </span>
            ))}
          </div>
          
          {/* Точки начала и конца сессий */}
          {sessionSegments.map((segment) => (
            <React.Fragment key={`${segment.session.id}-markers`}>
              <div
                className="timeline-marker start"
                style={{ left: `${segment.left}%` }}
                data-time={segment.session.start}
              />
              <div
                className="timeline-marker end"
                style={{ left: `${((segment.startMinutes + segment.duration) / 1440) * 100}%` }}
                data-time={segment.session.end}
              />
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};
