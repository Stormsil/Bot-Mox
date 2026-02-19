import { Card, Progress, Typography } from 'antd';
import type React from 'react';
import styles from './MetricCard.module.css';

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
    <Card
      className={styles.metricCard}
      variant="borderless"
      styles={{ body: { padding: 16 } }}
      style={{
        background: 'var(--boxmox-color-surface-panel)',
        border: '1px solid var(--boxmox-color-border-default)',
        borderRadius: 'var(--radius-sm)',
        height: '100%',
      }}
    >
      <div className={styles.header}>
        {icon && (
          <div className={styles.icon} style={{ color }}>
            {icon}
          </div>
        )}
        <Text className={styles.label} style={{ color: 'var(--boxmox-color-text-muted)' }}>
          {label}
        </Text>
      </div>
      <div className={styles.value} style={{ color }}>
        {value}
      </div>
      {progress !== undefined && (
        <div className={styles.progress}>
          <Progress
            percent={progress}
            size="small"
            strokeColor={color}
            trailColor="var(--boxmox-color-surface-muted)"
            strokeLinecap="butt"
            showInfo={false}
          />
        </div>
      )}
      {subtext && (
        <Text className={styles.subtext} style={{ color: 'var(--boxmox-color-text-muted)' }}>
          {subtext}
        </Text>
      )}
    </Card>
  );
};
