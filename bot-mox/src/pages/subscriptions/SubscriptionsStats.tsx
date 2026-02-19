import React from 'react';
import { Card } from 'antd';
import styles from './SubscriptionsPage.module.css';

interface SubscriptionsStatsData {
  total: number;
  active: number;
  expired: number;
  expiringSoon: number;
}

interface SubscriptionsStatsProps {
  collapsed: boolean;
  stats: SubscriptionsStatsData;
}

export const SubscriptionsStats: React.FC<SubscriptionsStatsProps> = ({ collapsed, stats }) => {
  if (collapsed) {
    return null;
  }

  return (
    <div className={styles.stats}>
      <Card className={styles.statCard}>
        <div className={styles.statValue}>{stats.total}</div>
        <div className={styles.statLabel}>Total</div>
      </Card>
      <Card className={`${styles.statCard} ${styles.statCardActive}`}>
        <div className={styles.statValue}>{stats.active}</div>
        <div className={styles.statLabel}>Active</div>
      </Card>
      <Card className={`${styles.statCard} ${styles.statCardWarning}`}>
        <div className={styles.statValue}>{stats.expiringSoon}</div>
        <div className={styles.statLabel}>Expiring Soon</div>
      </Card>
      <Card className={`${styles.statCard} ${styles.statCardExpired}`}>
        <div className={styles.statValue}>{stats.expired}</div>
        <div className={styles.statLabel}>Expired</div>
      </Card>
    </div>
  );
};
