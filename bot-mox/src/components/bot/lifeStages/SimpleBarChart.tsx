import React from 'react';
import { Typography } from 'antd';

const { Text } = Typography;

interface SimpleBarChartProps {
  data: number[];
  color: string;
  label: string;
}

export const SimpleBarChart: React.FC<SimpleBarChartProps> = ({ data, color, label }) => {
  const max = Math.max(...data);

  return (
    <div className="simple-bar-chart">
      <Text type="secondary" className="chart-label">
        {label}
      </Text>
      <div className="chart-bars">
        {data.map((value, index) => (
          <div
            key={index}
            className="chart-bar"
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
