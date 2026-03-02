import type { StatisticProps } from 'antd';
import { Statistic } from 'antd';
import type React from 'react';

interface AppStatisticProps extends StatisticProps {
  valueStyle?: React.CSSProperties;
}

const defaultValueStyle: React.CSSProperties = {
  color: 'var(--botmox-color-text-strong)',
  fontFamily: 'var(--botmox-font-condensed)',
  fontSize: 'var(--botmox-text-h2)',
  fontWeight: 700,
  lineHeight: 1.2,
};

const defaultStyle: React.CSSProperties = {
  fontFamily: 'var(--botmox-font-primary)',
};

export const AppStatistic: React.FC<AppStatisticProps> = ({ valueStyle, style, ...props }) => {
  return (
    <Statistic
      {...props}
      style={{ ...defaultStyle, ...style }}
      valueStyle={{ ...defaultValueStyle, ...valueStyle }}
    />
  );
};
