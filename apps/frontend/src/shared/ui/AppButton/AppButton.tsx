import type { ButtonProps } from 'antd';
import { Button } from 'antd';
import type React from 'react';

const defaultStyle: React.CSSProperties = {
  fontFamily: 'var(--botmox-font-primary)',
};

export const AppButton: React.FC<ButtonProps> = ({ size = 'small', style, ...props }) => {
  return <Button {...props} size={size} style={{ ...defaultStyle, ...style }} />;
};
