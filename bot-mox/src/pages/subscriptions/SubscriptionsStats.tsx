import React from 'react';
import { Card, Col, Row } from 'antd';
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
    <Row gutter={16} className={styles.stats}>
      <Col flex="1">
        <Card className={styles.statCard}>
          <div className={styles.statValue}>{stats.total}</div>
          <div className={styles.statLabel}>Total</div>
        </Card>
      </Col>
      <Col flex="1">
        <Card className={`${styles.statCard} ${styles.statCardActive}`}>
          <div className={styles.statValue}>{stats.active}</div>
          <div className={styles.statLabel}>Active</div>
        </Card>
      </Col>
      <Col flex="1">
        <Card className={`${styles.statCard} ${styles.statCardWarning}`}>
          <div className={styles.statValue}>{stats.expiringSoon}</div>
          <div className={styles.statLabel}>Expiring Soon</div>
        </Card>
      </Col>
      <Col flex="1">
        <Card className={`${styles.statCard} ${styles.statCardExpired}`}>
          <div className={styles.statValue}>{stats.expired}</div>
          <div className={styles.statLabel}>Expired</div>
        </Card>
      </Col>
    </Row>
  );
};
