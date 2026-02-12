import React from 'react';
import type { BotScheduleV2, ScheduleDay } from '../../types';
import { calculateDayStats, formatDuration, timeToMinutes } from '../../utils/scheduleUtils';
import './WeekPanel.css';

interface WeekPanelProps {
  schedule: BotScheduleV2 | null;
  selectedDay: number;
  onDaySelect: (day: number) => void;
}

const DAY_NAMES = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const FULL_DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// JS day index: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
// UI day index: 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
// Convert UI index to JS index: (uiIndex + 1) % 7
// Convert JS index to UI index: (jsIndex + 6) % 7
const uiToJsDay = (uiIndex: number): number => (uiIndex + 1) % 7;
const jsToUiDay = (jsIndex: number): number => (jsIndex + 6) % 7;

interface WeekStats {
  avgActiveMinutes: number;
  avgBreakMinutes: number;
  avgSessionCount: number;
  avgActivePercentage: number;
}

export const WeekPanel: React.FC<WeekPanelProps> = ({
  schedule,
  selectedDay,
  onDaySelect
}) => {
  // Calculate week statistics
  const calculateWeekStats = (): WeekStats => {
    if (!schedule) {
      return {
        avgActiveMinutes: 0,
        avgBreakMinutes: 0,
        avgSessionCount: 0,
        avgActivePercentage: 0
      };
    }

    let totalActiveMinutes = 0;
    let totalBreakMinutes = 0;
    let totalSessionCount = 0;
    let totalActivePercentage = 0;
    let activeDaysCount = 0;

    for (let day = 0; day <= 6; day++) {
      const dayKey = day.toString() as keyof typeof schedule.days;
      const dayData = schedule.days[dayKey];
      
      if (dayData && dayData.enabled) {
        const stats = calculateDayStats(dayData.sessions);
        totalActiveMinutes += stats.totalActiveMinutes;
        totalBreakMinutes += stats.totalBreakMinutes;
        totalSessionCount += stats.sessionCount;
        totalActivePercentage += stats.activePercentage;
        activeDaysCount++;
      }
    }

    const divisor = activeDaysCount || 1;
    return {
      avgActiveMinutes: Math.round(totalActiveMinutes / divisor),
      avgBreakMinutes: Math.round(totalBreakMinutes / divisor),
      avgSessionCount: Math.round((totalSessionCount / divisor) * 10) / 10,
      avgActivePercentage: Math.round(totalActivePercentage / divisor)
    };
  };

  const weekStats = calculateWeekStats();

  // Get day data safely
  const getDayData = (dayIndex: number): ScheduleDay => {
    if (!schedule) return { enabled: false, sessions: [] };
    const dayKey = dayIndex.toString() as keyof typeof schedule.days;
    return schedule.days[dayKey] || { enabled: false, sessions: [] };
  };

  // Get session segments for mini timeline
  const getSessionSegments = (dayData: ScheduleDay) => {
    if (!dayData.enabled || !dayData.sessions) return [];
    
    const sessions = Array.isArray(dayData.sessions) ? dayData.sessions : [];
    return sessions
      .filter(s => s.enabled)
      .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start))
      .map(session => {
        const startMinutes = timeToMinutes(session.start);
        const endMinutes = timeToMinutes(session.end);
        
        let duration: number;
        if (endMinutes < startMinutes) {
          duration = (1440 - startMinutes) + endMinutes;
        } else {
          duration = endMinutes - startMinutes;
        }

        return {
          left: (startMinutes / 1440) * 100,
          width: (duration / 1440) * 100
        };
      });
  };

  return (
    <div className="week-panel">
      <div className="week-panel-header">
        <h3 className="week-panel-title">WEEK</h3>
      </div>

      <div className="week-panel-selected-day">
        {FULL_DAY_NAMES[jsToUiDay(selectedDay)]}
      </div>

      <div className="week-panel-timelines">
        {DAY_NAMES.map((dayName, uiIndex) => {
          const jsDayIndex = uiToJsDay(uiIndex);
          const dayData = getDayData(jsDayIndex);
          const segments = getSessionSegments(dayData);
          const isSelected = selectedDay === jsDayIndex;
          const isEnabled = dayData.enabled && segments.length > 0;

          return (
            <button
              key={dayName}
              className={`week-day-item ${isSelected ? 'selected' : ''} ${isEnabled ? 'enabled' : 'disabled'}`}
              onClick={() => onDaySelect(jsDayIndex)}
            >
              <span className="week-day-name">{dayName}</span>
              <div className="week-day-timeline">
                <div className="week-day-timeline-track">
                  {segments.map((segment, segIndex) => (
                    <div
                      key={segIndex}
                      className="week-day-timeline-segment"
                      style={{
                        left: `${segment.left}%`,
                        width: `${segment.width}%`
                      }}
                    />
                  ))}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="week-panel-divider" />

      <div className="week-panel-stats">
        <div className="week-stat-item">
          <span className="week-stat-value">{formatDuration(weekStats.avgActiveMinutes)}</span>
          <span className="week-stat-label">Avg Active</span>
        </div>

        <div className="week-stat-item">
          <span className="week-stat-value">{formatDuration(weekStats.avgBreakMinutes)}</span>
          <span className="week-stat-label">Avg Break</span>
        </div>

        <div className="week-stat-item">
          <span className="week-stat-value">{weekStats.avgSessionCount}</span>
          <span className="week-stat-label">Avg Sessions</span>
        </div>

        <div className="week-stat-item">
          <span className="week-stat-value">{weekStats.avgActivePercentage}%</span>
          <span className="week-stat-label">Avg Day %</span>
        </div>
      </div>
    </div>
  );
};
