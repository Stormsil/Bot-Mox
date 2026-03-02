import type { SelectProps } from 'antd';
import { Select } from 'antd';
import type React from 'react';

const defaultStyle: React.CSSProperties = {
  fontFamily: 'var(--botmox-font-primary)',
};

const AppSelectBase: React.FC<SelectProps> = ({ size = 'small', style, ...props }) => {
  return <Select {...props} size={size} style={{ ...defaultStyle, ...style }} />;
};

export const AppSelect = Object.assign(AppSelectBase, Select) as typeof Select;
