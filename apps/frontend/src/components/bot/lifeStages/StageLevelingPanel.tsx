import {
  AimOutlined,
  ClockCircleOutlined,
  LineChartOutlined,
  RiseOutlined,
} from '@ant-design/icons';
import { Card, Col, Divider, Progress, Row, Statistic, Tag, Typography } from 'antd';
import type React from 'react';
import { mockAnalytics, mockLeveling } from './config';
import styles from './lifeStages.module.css';
import { SimpleBarChart } from './SimpleBarChart';

const { Text } = Typography;

export const StageLevelingPanel: React.FC = () => {
  const statValueStyle = { color: 'var(--boxmox-color-text-primary)' };
  const leveling = mockLeveling;
  const xpPercent = Math.round((leveling.current_xp / leveling.max_xp) * 100);
  const analytics = mockAnalytics.leveling;

  return (
    <div className={styles['stage-content']}>
      <Row gutter={[16, 16]}>
        <Col span={8}>
          <Card className={styles['stage-stat-card']}>
            <Statistic
              title={<span className={styles['stat-title']}>Current Level</span>}
              value={leveling.current_level}
              prefix={<RiseOutlined />}
              valueStyle={{ ...statValueStyle, color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card className={styles['stage-stat-card']}>
            <Statistic
              title={<span className={styles['stat-title']}>XP per Hour</span>}
              value={leveling.xp_per_hour.toLocaleString()}
              suffix="XP"
              valueStyle={{ ...statValueStyle, color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card className={styles['stage-stat-card']}>
            <Statistic
              title={<span className={styles['stat-title']}>Time to Level</span>}
              value={leveling.estimated_time_to_level}
              suffix="h"
              prefix={<ClockCircleOutlined />}
              valueStyle={{ ...statValueStyle, color: '#1890ff' }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        className={styles['stage-detail-card']}
        title={<span className={styles['detail-card-title']}>Experience Progress</span>}
        styles={{
          header: {
            background: 'var(--boxmox-color-surface-panel)',
            borderBottom: '1px solid var(--boxmox-color-border-default)',
          },
        }}
      >
        <div className={styles['xp-progress-section']}>
          <div className={styles['xp-info']}>
            <Text strong>Level {leveling.current_level}</Text>
            <Text type="secondary">
              {leveling.current_xp.toLocaleString()} / {leveling.max_xp.toLocaleString()} XP
            </Text>
          </div>
          <Progress
            percent={xpPercent}
            strokeColor="#722ed1"
            trailColor="var(--boxmox-color-border-default)"
            showInfo={false}
          />
          <div className={styles['xp-percent']}>{xpPercent}%</div>
        </div>
      </Card>

      <Card
        className={styles['stage-detail-card']}
        title={<span className={styles['detail-card-title']}>Current Location</span>}
        styles={{
          header: {
            background: 'var(--boxmox-color-surface-panel)',
            borderBottom: '1px solid var(--boxmox-color-border-default)',
          },
        }}
      >
        <div className={styles['location-info']}>
          <AimOutlined className={styles['location-icon']} />
          <div className={styles['location-details']}>
            <Text type="secondary">Location</Text>
            <Tag className={styles['location-tag']}>{leveling.location}</Tag>
          </div>
        </div>
      </Card>

      <Card
        className={[styles['stage-detail-card'], styles['analytics-card']].join(' ')}
        title={<span className={styles['detail-card-title']}>Leveling Analytics</span>}
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
              title={<span className={styles['stat-title']}>Total Time</span>}
              value={analytics.totalTime}
              suffix="h"
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: 'var(--boxmox-color-text-primary)' }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title={<span className={styles['stat-title']}>Levels Gained</span>}
              value={analytics.levelsGained}
              prefix={<RiseOutlined />}
              valueStyle={{ color: 'var(--boxmox-color-text-primary)' }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title={<span className={styles['stat-title']}>Avg XP/h</span>}
              value={analytics.avgXpPerHour.toLocaleString()}
              prefix={<LineChartOutlined />}
              valueStyle={{ color: 'var(--boxmox-color-text-primary)' }}
            />
          </Col>
        </Row>
        <Divider />
        <SimpleBarChart
          data={analytics.trend}
          color="#722ed1"
          label="XP/hour trend for recent sessions"
        />
      </Card>
    </div>
  );
};
