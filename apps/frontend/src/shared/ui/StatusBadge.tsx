import { Tag } from 'antd';
import type React from 'react';
import type { BotStatus } from '../types';
import styles from './StatusBadge.module.css';

interface StatusBadgeProps {
  status: BotStatus;
  showText?: boolean;
  size?: 'default' | 'small';
}

const statusConfig: Record<BotStatus, { color: string; text: string }> = {
  offline: { color: 'default', text: 'OFFLINE' },
  prepare: { color: 'processing', text: 'PREPARE' },
  leveling: { color: 'purple', text: 'LEVELING' },
  profession: { color: 'magenta', text: 'PROFESSION' },
  farming: { color: 'success', text: 'FARMING' },
  banned: { color: 'error', text: 'BANNED' },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  showText = true,
  size = 'default',
}) => {
  const config = statusConfig[status];

  return (
    <span className={styles.statusBadge} data-status={status} data-size={size}>
      {showText ? (
        <Tag bordered={false} color={config.color}>
          {config.text}
        </Tag>
      ) : null}
    </span>
  );
};
