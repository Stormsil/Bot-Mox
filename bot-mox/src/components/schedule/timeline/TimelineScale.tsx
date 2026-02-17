import React from 'react';
import styles from '../TimelineVisualizer.module.css';

interface TimelineScaleProps {
  hours: number[];
  labelStep?: number;
}

export const TimelineScale: React.FC<TimelineScaleProps> = ({ hours, labelStep = 2 }) => (
  <>
    {hours.map((hour) => (
      <div
        key={hour}
        className={styles['timeline-tick']}
        style={{ left: `${(hour / 24) * 100}%` }}
      />
    ))}

    <div className={styles['timeline-labels']}>
      {hours
        .filter((hour) => hour % labelStep === 0)
        .map((hour) => (
          <span
            key={hour}
            className={styles['timeline-time-label']}
            style={{ left: `${(hour / 24) * 100}%` }}
          >
            {hour.toString().padStart(2, '0')}:00
          </span>
        ))}
    </div>
  </>
);
