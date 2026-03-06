import type React from 'react';
import { getProxyStatusIntent } from '../../shared/lib/statusSemantic';
import { AppCol as Col, AppRow as Row } from '../../shared/ui';
import { MetricCard } from '../../shared/ui/MetricCard';
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
    <Row gutter={[12, 12]} className={styles.statsRow}>
      <Col flex="1 1 140px">
        <MetricCard label="Total" value={stats.total} />
      </Col>
      <Col flex="1 1 140px">
        <MetricCard label="Active" value={stats.active} intent={getProxyStatusIntent('active')} />
      </Col>
      <Col flex="1 1 140px">
        <MetricCard label="Expiring Soon" value={stats.expiringSoon} intent="warning" />
      </Col>
      <Col flex="1 1 140px">
        <MetricCard
          label="Expired"
          value={stats.expired}
          intent={getProxyStatusIntent('expired')}
        />
      </Col>
      <Col flex="1 1 140px">
        <MetricCard label="Unassigned" value={stats.unassigned} />
      </Col>
    </Row>
  );
};
