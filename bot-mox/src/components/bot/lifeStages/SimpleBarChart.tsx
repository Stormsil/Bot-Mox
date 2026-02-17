import React from 'react';
import { Typography } from 'antd';
import styles from './lifeStages.module.css';

const { Text } = Typography;

interface SimpleBarChartProps {
  data: number[];
  color: string;
  label: string;
}

export const SimpleBarChart: React.FC<SimpleBarChartProps> = ({ data, color, label }) => {
  const max = Math.max(...data);

  return (
    <div className={styles['simple-bar-chart']}>
      <Text type="secondary" className={styles['chart-label']}>
        {label}
      </Text>
      <div className={styles['chart-bars']}>
        {data.map((value, index) => (
          <div
            key={index}
            className={styles['chart-bar']}
            style={{
              height: `${(value / max) * 100}%`,
              backgroundColor: color,
            }}
            title={`${value}`}
          />
        ))}
      </div>
    </div>
  );
};
