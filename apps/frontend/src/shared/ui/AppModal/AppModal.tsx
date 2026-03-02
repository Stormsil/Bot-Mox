import type { ModalProps } from 'antd';
import { Modal } from 'antd';
import type React from 'react';

const defaultStyles: ModalProps['styles'] = {
  body: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
};

export const AppModal: React.FC<ModalProps> = (props) => {
  const mergedStyles: ModalProps['styles'] = {
    ...defaultStyles,
    ...props.styles,
    body: {
      ...defaultStyles?.body,
      ...props.styles?.body,
    },
  };

  return <Modal destroyOnClose maskClosable={false} {...props} styles={mergedStyles} />;
};
