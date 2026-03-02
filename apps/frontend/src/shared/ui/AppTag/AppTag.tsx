import type { TagProps } from 'antd';
import { Tag } from 'antd';
import type React from 'react';

type AppTagIntent = 'success' | 'warning' | 'error' | 'info' | 'default';

interface AppTagProps extends TagProps {
  intent?: AppTagIntent;
  customColor?: string;
}

const intentColorMap: Record<AppTagIntent, string> = {
  success: 'var(--botmox-color-status-success)',
  warning: 'var(--botmox-color-status-warning)',
  error: 'var(--botmox-color-status-danger)',
  info: 'var(--botmox-color-status-info)',
  default: 'var(--botmox-color-status-neutral)',
};

export const AppTag: React.FC<AppTagProps> = ({ intent, color, customColor, style, ...props }) => {
  const resolvedColor = customColor ?? color ?? (intent ? intentColorMap[intent] : undefined);

  return <Tag {...props} color={resolvedColor} style={{ ...style }} />;
};
