import { Card, Progress, Statistic, Typography } from 'antd';
import type React from 'react';
import { getSemanticIntentColorToken, type SemanticStatusIntent } from '../lib/statusSemantic';

const { Text } = Typography;

interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  progress?: number;
  icon?: React.ReactNode;
  intent?: SemanticStatusIntent;
  color?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  subtext,
  progress,
  icon,
  intent,
  color = 'var(--botmox-color-brand-primary)',
}) => {
  const resolvedColor = intent ? getSemanticIntentColorToken(intent) : color;

  return (
    <Card
      variant="borderless"
      style={{
        background: 'var(--botmox-color-surface-panel)',
        border: '1px solid var(--botmox-color-border-default)',
        borderRadius: 'var(--radius-sm)',
        height: '100%',
      }}
      styles={{ body: { display: 'flex', flexDirection: 'column', gap: 'var(--botmox-space-sm)' } }}
    >
      <Statistic
        title={
          <Text
            style={{
              color: 'var(--botmox-color-text-muted)',
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
            <span
              style={{
                color: resolvedColor,
                fontSize: 20,
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              {icon}
            </span>
          ) : undefined
        }
        valueStyle={{
          color: resolvedColor,
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
          strokeColor={resolvedColor}
          trailColor="var(--botmox-color-surface-muted)"
          strokeLinecap="butt"
          showInfo={false}
        />
      )}
      {subtext && (
        <Text style={{ color: 'var(--botmox-color-text-muted)', fontSize: 12 }}>{subtext}</Text>
      )}
    </Card>
  );
};
