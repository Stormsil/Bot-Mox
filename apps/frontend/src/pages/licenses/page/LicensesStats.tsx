import type React from 'react';
import { getLicenseStatusIntent } from '../../../shared/lib/statusSemantic';
import { AppCol as Col, AppRow as Row } from '../../../shared/ui';
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
        <MetricCard label="Active" value={stats.active} intent={getLicenseStatusIntent('active')} />
      </Col>
      <Col xs={12} sm={8} md={4}>
        <MetricCard label="Expiring Soon" value={stats.expiringSoon} intent="warning" />
      </Col>
      <Col xs={12} sm={8} md={4}>
        <MetricCard
          label="Expired"
          value={stats.expired}
          intent={getLicenseStatusIntent('expired')}
        />
      </Col>
      <Col xs={12} sm={8} md={4}>
        <MetricCard label="Unassigned" value={stats.unassigned} />
      </Col>
    </Row>
  );
};
