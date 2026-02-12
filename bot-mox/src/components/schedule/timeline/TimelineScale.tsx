import React from 'react';

interface TimelineScaleProps {
  hours: number[];
  labelStep?: number;
}

export const TimelineScale: React.FC<TimelineScaleProps> = ({ hours, labelStep = 2 }) => (
  <>
    {hours.map((hour) => (
      <div
        key={hour}
        className="timeline-tick"
        style={{ left: `${(hour / 24) * 100}%` }}
      />
    ))}

    <div className="timeline-labels">
      {hours
        .filter((hour) => hour % labelStep === 0)
        .map((hour) => (
          <span
            key={hour}
            className="timeline-time-label"
            style={{ left: `${(hour / 24) * 100}%` }}
          >
            {hour.toString().padStart(2, '0')}:00
          </span>
        ))}
    </div>
  </>
);
