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
  <div className={styles['summary-stat-item']}>
    <span className={styles['summary-stat-icon']}>{icon}</span>
    <div className={styles['summary-stat-content']}>
      <span className={styles['summary-stat-label']}>{label}</span>
      <span className={[styles['summary-stat-value'], valueClassName].filter(Boolean).join(' ')}>
        {value}
      </span>
    </div>
  </div>
);
