import { Typography } from 'antd';
import type React from 'react';
import styles from './lifeStages.module.css';

const { Text } = Typography;

interface SimpleBarChartProps {
  data: number[];
  color: string;
  label: string;
}

export const SimpleBarChart: React.FC<SimpleBarChartProps> = ({ data, color, label }) => {
  const max = Math.max(...data);
  const barKeyCounts = new Map<number, number>();

  return (
    <div className={styles['simple-bar-chart']}>
      <Text type="secondary" className={styles['chart-label']}>
        {label}
      </Text>
      <div className={styles['chart-bars']}>
        {data.map((value) => {
          const occurrence = barKeyCounts.get(value) || 0;
          barKeyCounts.set(value, occurrence + 1);
          return (
            <div
              key={`${value}-${occurrence}`}
              className={styles['chart-bar']}
              style={{
                height: `${(value / max) * 100}%`,
                backgroundColor: color,
              }}
              title={`${value}`}
            />
          );
        })}
      </div>
    </div>
  );
};
