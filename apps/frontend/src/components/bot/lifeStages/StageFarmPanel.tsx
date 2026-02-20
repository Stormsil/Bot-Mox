import {
  BarChartOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  ShoppingOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { Card, Col, Divider, List, Row, Statistic, Tag, Typography } from 'antd';
import type React from 'react';
import { getQualityColor, mockAnalytics, mockFarmStats, mockInventory } from './config';
import styles from './lifeStages.module.css';
import { SimpleBarChart } from './SimpleBarChart';

const { Text } = Typography;

interface StageFarmPanelProps {
  renderTimestamp: number;
  formatDuration: (ms: number) => string;
}

export const StageFarmPanel: React.FC<StageFarmPanelProps> = ({
  renderTimestamp,
  formatDuration,
}) => {
  const statValueStyle = { color: 'var(--boxmox-color-text-primary)' };
  const inventory = mockInventory;
  const farmStats = mockFarmStats;
  const sessionDuration = renderTimestamp - farmStats.session_start;
  const analytics = mockAnalytics.farm;

  return (
    <div className={styles['stage-content']}>
      <Row gutter={[16, 16]}>
        <Col span={8}>
          <Card className={styles['stage-stat-card']}>
            <Statistic
              title={<span className={styles['stat-title']}>Total Gold</span>}
              value={farmStats.total_gold.toLocaleString()}
              suffix="g"
              prefix={<DollarOutlined />}
              valueStyle={{ ...statValueStyle, color: '#ffd700' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card className={styles['stage-stat-card']}>
            <Statistic
              title={<span className={styles['stat-title']}>Gold per Hour</span>}
              value={farmStats.gold_per_hour.toFixed(1)}
              suffix="g/h"
              prefix={<ThunderboltOutlined />}
              valueStyle={{ ...statValueStyle, color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card className={styles['stage-stat-card']}>
            <Statistic
              title={<span className={styles['stat-title']}>Session Time</span>}
              value={formatDuration(sessionDuration)}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ ...statValueStyle, color: '#1890ff' }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        className={styles['stage-detail-card']}
        title={<span className={styles['detail-card-title']}>Inventory</span>}
        styles={{
          header: {
            background: 'var(--boxmox-color-surface-panel)',
            borderBottom: '1px solid var(--boxmox-color-border-default)',
          },
        }}
      >
        <List
          dataSource={inventory}
          renderItem={(item) => (
            <List.Item className={styles['inventory-item']}>
              <div className={styles['inventory-item-info']}>
                <ShoppingOutlined className={styles['inventory-item-icon']} />
                <div className={styles['inventory-item-details']}>
                  <Text strong style={{ color: getQualityColor(item.quality) }}>
                    {item.name}
                  </Text>
                  <Tag
                    className={styles['quality-tag']}
                    style={{ backgroundColor: getQualityColor(item.quality) }}
                  >
                    {item.quality}
                  </Tag>
                </div>
              </div>
              <Text className={styles['inventory-item-quantity']}>x{item.quantity}</Text>
            </List.Item>
          )}
        />
      </Card>

      <Card
        className={[styles['stage-detail-card'], styles['analytics-card']].join(' ')}
        title={<span className={styles['detail-card-title']}>Farm Analytics</span>}
        styles={{
          header: {
            background: 'var(--boxmox-color-surface-panel)',
            borderBottom: '1px solid var(--boxmox-color-border-default)',
          },
        }}
      >
        <Row gutter={[16, 16]}>
          <Col span={8}>
            <Statistic
              title={<span className={styles['stat-title']}>Farm Time</span>}
              value={analytics.totalTime}
              suffix="h"
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: 'var(--boxmox-color-text-primary)' }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title={<span className={styles['stat-title']}>Total Gold</span>}
              value={analytics.totalGold.toLocaleString()}
              suffix="g"
              prefix={<DollarOutlined />}
              valueStyle={{ color: 'var(--boxmox-color-text-primary)' }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title={<span className={styles['stat-title']}>Avg Income/h</span>}
              value={analytics.avgGoldPerHour.toFixed(1)}
              suffix="g/h"
              prefix={<BarChartOutlined />}
              valueStyle={{ color: 'var(--boxmox-color-text-primary)' }}
            />
          </Col>
        </Row>
        <Divider />
        <SimpleBarChart data={analytics.trend} color="#faad14" label="Gold/hour trend" />
      </Card>
    </div>
  );
};
