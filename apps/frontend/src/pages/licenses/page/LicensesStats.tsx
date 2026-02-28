import { Col, Row } from 'antd';
import type React from 'react';
import { MetricCard } from '../../../shared/ui/MetricCard';
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
      <Col xs={12} sm={8} md={4}>
        <MetricCard label="Unassigned" value={stats.unassigned} />
      </Col>
    </Row>
  );
};
