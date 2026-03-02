import type { DividerProps } from 'antd';
import { Divider } from 'antd';
import type React from 'react';

const defaultStyle: React.CSSProperties = {
  borderColor: 'var(--botmox-color-border-default)',
  marginBlock: 'var(--botmox-space-lg)',
};

export const AppDivider: React.FC<DividerProps> = (props) => {
  return <Divider {...props} style={{ ...defaultStyle, ...props.style }} />;
};
