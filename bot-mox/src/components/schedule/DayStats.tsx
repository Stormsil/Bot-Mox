import React from 'react';
import type { ScheduleSession } from '../../types';
import { calculateDayStats, formatDuration } from '../../utils/scheduleUtils';
import styles from './DayStats.module.css';

interface DayStatsProps {
  sessions: ScheduleSession[];
  className?: string;
}

export const DayStats: React.FC<DayStatsProps> = ({ sessions, className }) => {
  const stats = calculateDayStats(sessions);

  return (
    <div
      className={[styles['day-stats'], className].filter(Boolean).join(' ')}
    >
      <div className={styles['stat-item']}>
        <span className={styles['stat-value']}>{formatDuration(stats.totalActiveMinutes)}</span>
        <span className={styles['stat-label']}>Active Time</span>
      </div>

      <div className={styles['stat-divider']} />

      <div className={styles['stat-item']}>
        <span className={styles['stat-value']}>{formatDuration(stats.totalBreakMinutes)}</span>
        <span className={styles['stat-label']}>Break Time</span>
      </div>

      <div className={styles['stat-divider']} />

      <div className={styles['stat-item']}>
        <span className={styles['stat-value']}>{stats.sessionCount}</span>
        <span className={styles['stat-label']}>Sessions</span>
      </div>

      <div className={styles['stat-divider']} />

      <div className={styles['stat-item']}>
        <span className={styles['stat-value']}>{stats.activePercentage}%</span>
        <span className={styles['stat-label']}>Of Day</span>
      </div>
    </div>
  );
};
