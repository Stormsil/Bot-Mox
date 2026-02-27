import { Card, Progress, Statistic, Typography } from 'antd';
import type React from 'react';

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
      variant="borderless"
      style={{
        background: 'var(--boxmox-color-surface-panel)',
        border: '1px solid var(--boxmox-color-border-default)',
        borderRadius: 'var(--radius-sm)',
        height: '100%',
      }}
      styles={{ body: { display: 'flex', flexDirection: 'column', gap: 8 } }}
    >
      <Statistic
        title={
          <Text
            style={{
              color: 'var(--boxmox-color-text-muted)',
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            {label}
          </Text>
        }
        value={value}
        prefix={
          icon ? (
            <span style={{ color, fontSize: 20, display: 'inline-flex', alignItems: 'center' }}>
              {icon}
            </span>
          ) : undefined
        }
        valueStyle={{
          color,
          fontFamily: '"Roboto Condensed", sans-serif',
          fontSize: 24,
          fontWeight: 700,
          lineHeight: 1.2,
        }}
      />
      {progress !== undefined && (
        <Progress
          percent={progress}
          size="small"
          strokeColor={color}
          trailColor="var(--boxmox-color-surface-muted)"
          strokeLinecap="butt"
          showInfo={false}
        />
      )}
      {subtext && (
        <Text style={{ color: 'var(--boxmox-color-text-muted)', fontSize: 12 }}>{subtext}</Text>
      )}
    </Card>
  );
};
