import type { SwitchProps } from 'antd';
import { Switch } from 'antd';
import type React from 'react';

const defaultStyle: React.CSSProperties = {
  fontFamily: 'var(--botmox-font-primary)',
};

export const AppSwitch: React.FC<SwitchProps> = ({ size = 'small', style, ...props }) => {
  return <Switch {...props} size={size} style={{ ...defaultStyle, ...style }} />;
};
