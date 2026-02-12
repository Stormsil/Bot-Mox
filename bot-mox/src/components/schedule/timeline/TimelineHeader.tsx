import React from 'react';

interface TimelineHeaderProps {
  showLegend: boolean;
}

export const TimelineHeader: React.FC<TimelineHeaderProps> = ({ showLegend }) => (
  <div className="timeline-header">
    <h4 className="timeline-title">Day Timeline</h4>
    {showLegend && (
      <div className="timeline-header-legend">
        <div className="legend-item">
          <div className="legend-bar" />
          <span>Active</span>
        </div>
        <div className="legend-item">
          <div className="legend-bar overlap" />
          <span>Overlap</span>
        </div>
        <div className="legend-item">
          <div className="legend-bar restricted" />
          <span>Restricted</span>
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
    )}
  </div>
);
