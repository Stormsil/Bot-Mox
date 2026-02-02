import React from 'react';
import { Badge } from 'antd';
import type { BotStatus } from '../../types';
import './StatusBadge.css';

interface StatusBadgeProps {
  status: BotStatus;
  showText?: boolean;
  size?: 'default' | 'small';
}

const statusConfig: Record<BotStatus, { color: string; text: string }> = {
  offline: { color: '#8c8c8c', text: 'OFFLINE' },
  prepare: { color: '#1890ff', text: 'PREPARE' },
  leveling: { color: '#722ed1', text: 'LEVELING' },
  profession: { color: '#eb2f96', text: 'PROFESSION' },
  farming: { color: '#52c41a', text: 'FARMING' },
  banned: { color: '#f5222d', text: 'BANNED' },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  showText = true,
  size = 'default',
}) => {
  const config = statusConfig[status];

  return (
    <span className={`status-badge status-badge--${status} status-badge--${size}`}>
      <Badge
        color={config.color}
        text={showText ? config.text : undefined}
      />
    </span>
  );
};
