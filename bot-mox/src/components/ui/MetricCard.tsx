import React from 'react';
import { Card, Progress, Typography } from 'antd';
import './MetricCard.css';

const { Text } = Typography;

interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  progress?: number;
  icon?: React.ReactNode;
  color?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  subtext,
  progress,
  icon,
  color = 'var(--boxmox-color-brand-primary)',
}) => {
  return (
    <Card className="metric-card" bordered={false}>
      <div className="metric-header">
        {icon && <div className="metric-icon" style={{ color }}>{icon}</div>}
        <Text className="metric-label">{label}</Text>
      </div>
      <div className="metric-value" style={{ color }}>
        {value}
      </div>
      {progress !== undefined && (
        <div className="metric-progress">
          <Progress
            percent={progress}
            size="small"
            strokeColor={color}
            trailColor="var(--boxmox-color-border-subtle)"
            showInfo={false}
          />
        </div>
      )}
      {subtext && (
        <Text className="metric-subtext">{subtext}</Text>
      )}
    </Card>
  );
};
