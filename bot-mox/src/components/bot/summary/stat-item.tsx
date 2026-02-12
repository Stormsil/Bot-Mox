import React from 'react';

interface SummaryStatItemProps {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  valueClassName?: string;
}

export const SummaryStatItem: React.FC<SummaryStatItemProps> = ({ label, value, icon, valueClassName }) => (
  <div className="summary-stat-item">
    <span className="summary-stat-icon">{icon}</span>
    <div className="summary-stat-content">
      <span className="summary-stat-label">{label}</span>
      <span className={`summary-stat-value ${valueClassName || ''}`}>{value}</span>
    </div>
  </div>
);
