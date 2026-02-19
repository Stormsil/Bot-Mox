import { Card } from 'antd';
import type React from 'react';
import styles from '../LicensesPage.module.css';
import type { LicensesStats } from './types';

interface LicensesStatsProps {
  stats: LicensesStats;
  collapsed: boolean;
}

export const LicensesStatsPanel: React.FC<LicensesStatsProps> = ({ stats, collapsed }) => {
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
      <Card className={styles.statCard}>
        <div className={styles.statValue}>{stats.unassigned}</div>
        <div className={styles.statLabel}>Unassigned</div>
      </Card>
    </div>
  );
};
