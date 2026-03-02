import type { InputProps } from 'antd';
import { Input } from 'antd';
import type React from 'react';

const defaultStyle: React.CSSProperties = {
  fontFamily: 'var(--botmox-font-primary)',
};

const AppInputBase: React.FC<InputProps> = ({ size = 'small', style, ...props }) => {
  return <Input {...props} size={size} style={{ ...defaultStyle, ...style }} />;
};

export const AppInput = Object.assign(AppInputBase, Input) as typeof Input;
