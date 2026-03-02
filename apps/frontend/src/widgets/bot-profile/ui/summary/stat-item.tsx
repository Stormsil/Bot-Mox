import { Flex } from 'antd';
import type React from 'react';
import styles from '../BotSummary.module.css';

interface SummaryStatItemProps {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  valueClassName?: string;
}

export const SummaryStatItem: React.FC<SummaryStatItemProps> = ({
  label,
  value,
  icon,
  valueClassName,
}) => (
  <Flex className={styles['summary-stat-item']} align="flex-start" gap={12}>
    <span className={styles['summary-stat-icon']}>{icon}</span>
    <Flex vertical className={styles['summary-stat-content']} gap={4}>
      <span className={styles['summary-stat-label']}>{label}</span>
      <span className={[styles['summary-stat-value'], valueClassName].filter(Boolean).join(' ')}>
        {value}
      </span>
    </Flex>
  </Flex>
);
