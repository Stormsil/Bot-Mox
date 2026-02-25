import { Modal, type ModalProps } from 'antd';
import type React from 'react';

type ModalStyles = NonNullable<ModalProps['styles']>;

const themeModalStyles: ModalStyles = {
  mask: {
    background: 'rgba(var(--boxmox-color-brand-primary-rgb), 0.08)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
  },
  content: {
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--boxmox-color-border-default)',
    background: 'var(--boxmox-color-surface-panel)',
    overflow: 'hidden',
    boxShadow: '0 20px 54px rgba(0, 0, 0, 0.35)',
  },
  header: {
    background: 'var(--boxmox-color-surface-muted)',
    borderBottom: '1px solid var(--boxmox-color-border-default)',
  },
  body: {
    background: 'var(--boxmox-color-surface-panel)',
  },
  footer: {
    borderTop: '1px solid var(--boxmox-color-border-default)',
    background: 'var(--boxmox-color-surface-muted)',
  },
};

const mergeSlot = (
  base: ModalStyles[keyof ModalStyles],
  override: ModalStyles[keyof ModalStyles] | undefined,
) => {
  if (!base) {
    return override;
  }
  if (!override) {
    return base;
  }
  return { ...base, ...override };
};

export const ThemeModal: React.FC<ModalProps> = ({ styles, ...props }) => {
  const mergedStyles: ModalStyles = {
    ...(styles ?? {}),
    mask: mergeSlot(themeModalStyles.mask, styles?.mask),
    content: mergeSlot(themeModalStyles.content, styles?.content),
    header: mergeSlot(themeModalStyles.header, styles?.header),
    body: mergeSlot(themeModalStyles.body, styles?.body),
    footer: mergeSlot(themeModalStyles.footer, styles?.footer),
  };

  return <Modal {...props} styles={mergedStyles} />;
};
