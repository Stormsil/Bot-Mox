import React from 'react';
import { Card } from 'antd';
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
    <div className="licenses-stats">
      <Card className="stat-card">
        <div className="stat-value">{stats.total}</div>
        <div className="stat-label">Total</div>
      </Card>
      <Card className="stat-card active">
        <div className="stat-value">{stats.active}</div>
        <div className="stat-label">Active</div>
      </Card>
      <Card className="stat-card warning">
        <div className="stat-value">{stats.expiringSoon}</div>
        <div className="stat-label">Expiring Soon</div>
      </Card>
      <Card className="stat-card expired">
        <div className="stat-value">{stats.expired}</div>
        <div className="stat-label">Expired</div>
      </Card>
      <Card className="stat-card">
        <div className="stat-value">{stats.unassigned}</div>
        <div className="stat-label">Unassigned</div>
      </Card>
    </div>
  );
};
