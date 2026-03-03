import type React from 'react';
import { getBotStatusIntent } from '../lib/statusSemantic';
import type { BotStatus } from '../types';
import { AppTag } from './AppTag/AppTag';
import styles from './StatusBadge.module.css';

interface StatusBadgeProps {
  status: BotStatus;
  showText?: boolean;
  size?: 'default' | 'small';
}

const statusConfig: Record<BotStatus, { text: string }> = {
  offline: { text: 'OFFLINE' },
  prepare: { text: 'PREPARE' },
  leveling: { text: 'LEVELING' },
  profession: { text: 'PROFESSION' },
  farming: { text: 'FARMING' },
  banned: { text: 'BANNED' },
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
        <AppTag bordered={false} intent={getBotStatusIntent(status)}>
          {config.text}
        </AppTag>
      ) : null}
    </span>
  );
};
