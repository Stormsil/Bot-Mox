import { Typography } from 'antd';
import type { TextProps } from 'antd/es/typography/Text';
import type React from 'react';

const { Text } = Typography;

export type AppTextType = 'primary' | 'secondary' | 'muted' | 'danger' | 'success';
export type AppTextVariant = 'body' | 'caption' | 'label';

export interface AppTextProps extends Omit<TextProps, 'type'> {
  type?: AppTextType;
  variant?: AppTextVariant;
}

const typeColorMap: Record<AppTextType, string> = {
  primary: 'var(--botmox-color-text-primary)',
  secondary: 'var(--botmox-color-text-secondary)',
  muted: 'var(--botmox-color-text-muted)',
  danger: 'var(--botmox-color-status-danger)',
  success: 'var(--botmox-color-status-success)',
};

const variantStyleMap: Record<AppTextVariant, React.CSSProperties> = {
  body: {
    fontSize: 'var(--botmox-text-body)',
    lineHeight: 1.5,
  },
  caption: {
    fontSize: 'var(--botmox-text-caption)',
    lineHeight: 1.4,
  },
  label: {
    fontSize: 'var(--botmox-text-h6)',
    fontWeight: 500,
    lineHeight: 1.3,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
};

const defaultStyle: React.CSSProperties = {
  fontFamily: 'var(--botmox-font-primary)',
};

export const AppText: React.FC<AppTextProps> = ({
  type = 'primary',
  variant = 'body',
  style,
  ...props
}) => {
  return (
    <Text
      {...props}
      style={{
        ...defaultStyle,
        ...variantStyleMap[variant],
        color: typeColorMap[type],
        ...style,
      }}
    />
  );
};
