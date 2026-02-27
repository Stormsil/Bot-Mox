import { Col, Row } from 'antd';
import type React from 'react';
import { MetricCard } from '../../components/ui/MetricCard';

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
          color="var(--boxmox-color-status-success)"
        />
      </Col>
      <Col xs={12} sm={8} md={4}>
        <MetricCard
          label="Expiring Soon"
          value={stats.expiringSoon}
          color="var(--boxmox-color-status-warning)"
        />
      </Col>
      <Col xs={12} sm={8} md={4}>
        <MetricCard
          label="Expired"
          value={stats.expired}
          color="var(--boxmox-color-status-danger)"
        />
      </Col>
    </Row>
  );
};
