import type React from 'react';
import { getSubscriptionStatusIntent } from '../../shared/lib/statusSemantic';
import { AppCol as Col, AppRow as Row } from '../../shared/ui';
import { MetricCard } from '../../shared/ui/MetricCard';

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
    <Row gutter={[16, 16]}>
      <Col xs={12} sm={8} md={4}>
        <MetricCard label="Total" value={stats.total} />
      </Col>
      <Col xs={12} sm={8} md={4}>
        <MetricCard
          label="Active"
          value={stats.active}
          intent={getSubscriptionStatusIntent('active')}
        />
      </Col>
      <Col xs={12} sm={8} md={4}>
        <MetricCard
          label="Expiring Soon"
          value={stats.expiringSoon}
          intent={getSubscriptionStatusIntent('expiring_soon')}
        />
      </Col>
      <Col xs={12} sm={8} md={4}>
        <MetricCard
          label="Expired"
          value={stats.expired}
          intent={getSubscriptionStatusIntent('expired')}
        />
      </Col>
    </Row>
  );
};
