import React from 'react';
import { Button, Space, Tooltip } from 'antd';
import type { ButtonProps, SpaceProps } from 'antd';
import './TableActionButton.css';

type TableActionButtonProps = Omit<ButtonProps, 'type' | 'size'> & {
  tooltip?: React.ReactNode;
  buttonType?: ButtonProps['type'];
  buttonSize?: ButtonProps['size'];
};

export const TableActionButton: React.FC<TableActionButtonProps> = ({
  tooltip,
  className,
  buttonType,
  buttonSize,
  children,
  ...buttonProps
}) => {
  const mergedClassName = ['table-action-btn', className].filter(Boolean).join(' ');

  const button = (
    <Button
      type={buttonType ?? 'text'}
      size={buttonSize ?? 'small'}
      className={mergedClassName}
      {...buttonProps}
    >
      {children}
    </Button>
  );

  if (!tooltip) {
    return button;
  }

  return <Tooltip title={tooltip}>{button}</Tooltip>;
};

type TableActionGroupProps = SpaceProps;

export const TableActionGroup: React.FC<TableActionGroupProps> = ({ className, ...props }) => {
  const mergedClassName = ['table-action-group', className].filter(Boolean).join(' ');
  return <Space size="small" className={mergedClassName} {...props} />;
};
