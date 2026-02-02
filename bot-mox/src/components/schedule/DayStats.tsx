import React from 'react';
import type { ScheduleSession } from '../../types';
import { calculateDayStats, formatDuration } from '../../utils/scheduleUtils';
import './DayStats.css';

interface DayStatsProps {
  sessions: ScheduleSession[];
}

export const DayStats: React.FC<DayStatsProps> = ({ sessions }) => {
  const stats = calculateDayStats(sessions);

  return (
    <div className="day-stats">
      <div className="stat-item">
        <span className="stat-value">{formatDuration(stats.totalActiveMinutes)}</span>
        <span className="stat-label">Active Time</span>
      </div>

      <div className="stat-divider" />

      <div className="stat-item">
        <span className="stat-value">{formatDuration(stats.totalBreakMinutes)}</span>
        <span className="stat-label">Break Time</span>
      </div>

      <div className="stat-divider" />

      <div className="stat-item">
        <span className="stat-value">{stats.sessionCount}</span>
        <span className="stat-label">Sessions</span>
      </div>

      <div className="stat-divider" />

      <div className="stat-item">
        <span className="stat-value">{stats.activePercentage}%</span>
        <span className="stat-label">Of Day</span>
      </div>
    </div>
  );
};
