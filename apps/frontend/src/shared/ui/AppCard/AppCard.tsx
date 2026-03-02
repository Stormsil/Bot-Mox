import type { CardProps } from 'antd';
import { Card } from 'antd';
import type React from 'react';

const defaultStyles: CardProps['styles'] = {
  body: {
    padding: 'var(--botmox-space-lg)',
  },
  header: {
    background: 'var(--botmox-color-surface-muted)',
    borderColor: 'var(--botmox-color-border-default)',
    paddingInline: 'var(--botmox-space-lg)',
    paddingBlock: 'var(--botmox-space-md)',
  },
};

const defaultStyle: React.CSSProperties = {
  borderColor: 'var(--botmox-color-border-default)',
};

export const AppCard: React.FC<CardProps> = (props) => {
  const mergedStyles: CardProps['styles'] = {
    ...defaultStyles,
    ...props.styles,
    body: {
      ...defaultStyles?.body,
      ...props.styles?.body,
    },
    header: {
      ...defaultStyles?.header,
      ...props.styles?.header,
    },
  };

  return <Card {...props} style={{ ...defaultStyle, ...props.style }} styles={mergedStyles} />;
};
