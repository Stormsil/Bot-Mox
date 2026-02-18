import React from 'react';
import { Card, Progress, Statistic, Row, Col, Typography, Tag } from 'antd';
import { RiseOutlined, ClockCircleOutlined, AimOutlined } from '@ant-design/icons';
import type { Bot, LevelingProgress } from '../../types';
import styles from './BotLeveling.module.css';

const { Text } = Typography;

interface BotLevelingProps {
  bot: Bot;
}

// Моковые данные прогресса прокачки
const mockLeveling: LevelingProgress = {
  current_level: 42,
  current_xp: 125000,
  max_xp: 180000,
  xp_per_hour: 8500,
  estimated_time_to_level: 6.5,
  location: 'Stranglethorn Vale',
};

export const BotLeveling: React.FC<BotLevelingProps> = () => {
  const leveling = mockLeveling;
  const xpPercent = Math.round((leveling.current_xp / leveling.max_xp) * 100);

  return (
    <div className={styles['bot-leveling']}>
      <Row gutter={[16, 16]}>
        <Col span={8}>
          <Card className={styles['leveling-stat-card']} styles={{ body: { padding: 16 } }}>
            <Statistic
              title={<span className={styles['leveling-stat-card-title']}>Current Level</span>}
              value={leveling.current_level}
              prefix={<RiseOutlined />}
              valueStyle={{ color: '#722ed1', fontSize: 'var(--text-xl)', fontWeight: 600 }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card className={styles['leveling-stat-card']} styles={{ body: { padding: 16 } }}>
            <Statistic
              title={<span className={styles['leveling-stat-card-title']}>XP per Hour</span>}
              value={leveling.xp_per_hour.toLocaleString()}
              suffix="XP"
              valueStyle={{ color: '#52c41a', fontSize: 'var(--text-xl)', fontWeight: 600 }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card className={styles['leveling-stat-card']} styles={{ body: { padding: 16 } }}>
            <Statistic
              title={<span className={styles['leveling-stat-card-title']}>Time to Level</span>}
              value={leveling.estimated_time_to_level}
              suffix="h"
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#1890ff', fontSize: 'var(--text-xl)', fontWeight: 600 }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        className={styles['leveling-progress-card']}
        title={<span className={styles['leveling-progress-card-title']}>Experience Progress</span>}
        styles={{
          header: {
            background: 'var(--boxmox-color-surface-muted)',
            borderColor: 'var(--boxmox-color-border-default)',
          },
        }}
      >
        <div className={styles['xp-progress-section']}>
          <div className={styles['xp-info']}>
            <Text strong className={styles['text-primary']}>
              Level {leveling.current_level}
            </Text>
            <Text type="secondary" className={styles['text-primary']}>
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

      <Card className={styles['leveling-location-card']}>
        <div className={styles['location-info']}>
          <AimOutlined className={styles['location-icon']} />
          <div className={styles['location-details']}>
            <Text type="secondary" className={styles['location-details-label']}>
              Current Location
            </Text>
            <Tag className={styles['location-tag']}>{leveling.location}</Tag>
          </div>
        </div>
      </Card>
    </div>
  );
};
