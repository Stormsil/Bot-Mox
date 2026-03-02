import { Typography } from 'antd';
import type { TitleProps } from 'antd/es/typography/Title';
import type React from 'react';

const { Title } = Typography;

export type AppTitleVariant = 'page' | 'section' | 'subsection';

export interface AppTitleProps extends Omit<TitleProps, 'level'> {
  variant?: AppTitleVariant;
}

const variantStyleMap: Record<AppTitleVariant, React.CSSProperties> = {
  page: {
    fontSize: 'var(--botmox-text-h1)',
    fontWeight: 700,
    lineHeight: 1.25,
  },
  section: {
    fontSize: 'var(--botmox-text-h2)',
    fontWeight: 700,
    lineHeight: 1.3,
  },
  subsection: {
    fontSize: 'var(--botmox-text-h3)',
    fontWeight: 600,
    lineHeight: 1.35,
  },
};

const variantLevelMap: Record<AppTitleVariant, NonNullable<TitleProps['level']>> = {
  page: 1,
  section: 2,
  subsection: 3,
};

const defaultStyle: React.CSSProperties = {
  color: 'var(--botmox-color-text-strong)',
  fontFamily: 'var(--botmox-font-condensed)',
  margin: 0,
};

export const AppTitle: React.FC<AppTitleProps> = ({ variant = 'section', style, ...props }) => {
  return (
    <Title
      {...props}
      level={variantLevelMap[variant]}
      style={{
        ...defaultStyle,
        ...variantStyleMap[variant],
        ...style,
      }}
    />
  );
};
