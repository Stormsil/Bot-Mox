import type React from 'react';
import { AppFlex as Flex, AppTypography as Typography } from '../../../../shared/ui';
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
    <Flex vertical className={styles['simple-bar-chart']}>
      <Text type="secondary" className={styles['chart-label']}>
        {label}
      </Text>
      <Flex className={styles['chart-bars']} align="flex-end" justify="space-between" gap={4}>
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
      </Flex>
    </Flex>
  );
};
