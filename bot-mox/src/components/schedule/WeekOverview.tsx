import React, { useCallback } from 'react';
import type { BotScheduleV2, ScheduleSession } from '../../types';
import { TimelineVisualizer } from './TimelineVisualizer';
import { sortSessions, getDayName, formatDateShort, getWeekDates } from '../../utils/scheduleUtils';
import './WeekOverview.css';

interface WeekOverviewProps {
  schedule: BotScheduleV2 | null;
  onScheduleChange: (schedule: BotScheduleV2) => void;
  onSave: () => void;
  onReset: () => void;
  hasChanges: boolean;
  onDaySelect: (day: number) => void;
}

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon, Tue, Wed, Thu, Fri, Sat, Sun

export const WeekOverview: React.FC<WeekOverviewProps> = ({
  schedule,
  onScheduleChange,
  onSave,
  onReset,
  hasChanges,
  onDaySelect
}) => {
  void onSave;
  void onReset;
  void hasChanges;
  const weekDates = getWeekDates();

  // Get day data safely
  const getDayData = (dayIndex: number) => {
    if (!schedule) return { enabled: false, sessions: [] };
    const dayKey = dayIndex.toString() as keyof typeof schedule.days;
    return schedule.days[dayKey] || { enabled: false, sessions: [] };
  };

  // Handle session change from timeline drag-and-drop for a specific day
  const handleSessionChange = useCallback((dayIndex: number, session: ScheduleSession) => {
    if (!schedule) return;

    const dayKey = dayIndex.toString() as keyof typeof schedule.days;
    const dayData = schedule.days[dayKey];
    const sessionsArray = Array.isArray(dayData.sessions) ? dayData.sessions : [];
    const newSessions = sessionsArray.map(s =>
      s.id === session.id ? session : s
    );

    const newSchedule: BotScheduleV2 = {
      ...schedule,
      days: {
        ...schedule.days,
        [dayKey]: {
          ...dayData,
          sessions: sortSessions(newSessions),
          enabled: newSessions.some(s => s.enabled)
        }
      },
      updated_at: Date.now()
    };

    onScheduleChange(newSchedule);
  }, [schedule, onScheduleChange]);

  // Get date for a specific day index
  const getDateForDay = (dayIndex: number): Date => {
    // Find the date in weekDates that matches this day index
    const date = weekDates.find(d => d.getDay() === dayIndex);
    return date || new Date();
  };

  if (!schedule) {
    return (
      <div className="week-overview-empty">
        <p>No schedule data available</p>
      </div>
    );
  }

  return (
    <div className="week-overview">
      {/* Header */}
      <div className="week-overview-header">
        <div className="week-overview-title">
          <h3>Week Overview</h3>
          <span className="week-overview-subtitle">7 days at a glance</span>
        </div>
      </div>

      {/* 7 Timeline rows - Top to Bottom (MON at top) */}
      <div className="week-overview-timelines">
        {DAY_ORDER.map((dayIndex) => {
          const dayData = getDayData(dayIndex);
          const date = getDateForDay(dayIndex);
          const dayName = getDayName(dayIndex, true);
          const hasSessions = dayData.enabled && dayData.sessions && dayData.sessions.some(s => s.enabled);

          return (
            <div key={dayIndex} className="week-day-row">
              <button
                className="week-day-label"
                onClick={() => onDaySelect(dayIndex)}
                title={`Click to edit ${dayName}`}
              >
                <span className="week-day-name">{dayName}</span>
                <span className="week-day-date">{formatDateShort(date)}</span>
                <span className={`week-day-status ${hasSessions ? 'active' : 'disabled'}`} />
              </button>
              <div className="week-day-timeline-wrapper">
                <TimelineVisualizer
                  sessions={dayData.sessions}
                  allowedWindows={schedule.allowedWindows}
                  onSessionChange={(session) => handleSessionChange(dayIndex, session)}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="week-overview-legend">
        <div className="legend-item">
          <div className="legend-bar" />
          <span>Active</span>
        </div>
        <div className="legend-item">
          <div className="legend-bar overlap" />
          <span>Overlap (Fix manually)</span>
        </div>
        <div className="legend-item">
          <div className="legend-marker start" />
          <span>Start</span>
        </div>
        <div className="legend-item">
          <div className="legend-marker end" />
          <span>End</span>
        </div>
        <div className="legend-item">
          <span className="legend-text">Drag bars to move, edges to resize. Red areas are restricted.</span>
        </div>
      </div>
    </div>
  );
};
