import React from 'react';
import styles from '../TimelineVisualizer.module.css';

interface TimelineHeaderProps {
  showLegend: boolean;
  variant?: 'default' | 'compact';
}

export const TimelineHeader: React.FC<TimelineHeaderProps> = ({ showLegend }) => (
  <div className={styles['timeline-header']}>
    <h4 className={styles['timeline-title']}>Day Timeline</h4>
    {showLegend && (
      <div className={styles['timeline-header-legend']}>
        <div className={styles['legend-item']}>
          <div className={styles['legend-bar']} />
          <span>Active</span>
        </div>
        <div className={styles['legend-item']}>
          <div className={[styles['legend-bar'], styles.overlap].join(' ')} />
          <span>Overlap</span>
        </div>
        <div className={styles['legend-item']}>
          <div className={[styles['legend-bar'], styles.restricted].join(' ')} />
          <span>Restricted</span>
        </div>
        <div className={styles['legend-item']}>
          <div className={[styles['legend-marker'], styles.start].join(' ')} />
          <span>Start</span>
        </div>
        <div className={styles['legend-item']}>
          <div className={[styles['legend-marker'], styles.end].join(' ')} />
          <span>End</span>
        </div>
      </div>
    )}
  </div>
);
