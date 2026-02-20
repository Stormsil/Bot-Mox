import { Card } from 'antd';
import type React from 'react';
import styles from './ProxiesPage.module.css';

interface ProxiesStats {
  total: number;
  active: number;
  expiringSoon: number;
  expired: number;
  unassigned: number;
}

export const ProxiesStatsCards: React.FC<{
  stats: ProxiesStats;
}> = ({ stats }) => {
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
      <Card className={styles.statCard}>
        <div className={styles.statValue}>{stats.unassigned}</div>
        <div className={styles.statLabel}>Unassigned</div>
      </Card>
    </div>
  );
};
