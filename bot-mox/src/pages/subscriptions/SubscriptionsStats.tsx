import React from 'react';
import { Card, Col, Row } from 'antd';

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
    <Row gutter={16} className="subscriptions-stats">
      <Col span={6}>
        <Card className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total</div>
        </Card>
      </Col>
      <Col span={6}>
        <Card className="stat-card active">
          <div className="stat-value">{stats.active}</div>
          <div className="stat-label">Active</div>
        </Card>
      </Col>
      <Col span={6}>
        <Card className="stat-card warning">
          <div className="stat-value">{stats.expiringSoon}</div>
          <div className="stat-label">Expiring Soon</div>
        </Card>
      </Col>
      <Col span={6}>
        <Card className="stat-card expired">
          <div className="stat-value">{stats.expired}</div>
          <div className="stat-label">Expired</div>
        </Card>
      </Col>
    </Row>
  );
};
