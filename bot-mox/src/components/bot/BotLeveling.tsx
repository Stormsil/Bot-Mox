import React from 'react';
import { Card, Progress, Statistic, Row, Col, Typography, Tag } from 'antd';
import { RiseOutlined, ClockCircleOutlined, AimOutlined } from '@ant-design/icons';
import type { Bot, LevelingProgress } from '../../types';
import './BotLeveling.css';

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
    <div className="bot-leveling">
      <Row gutter={[16, 16]}>
        <Col span={8}>
          <Card className="leveling-stat-card">
            <Statistic
              title="Current Level"
              value={leveling.current_level}
              prefix={<RiseOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card className="leveling-stat-card">
            <Statistic
              title="XP per Hour"
              value={leveling.xp_per_hour.toLocaleString()}
              suffix="XP"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card className="leveling-stat-card">
            <Statistic
              title="Time to Level"
              value={leveling.estimated_time_to_level}
              suffix="h"
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
      </Row>

      <Card className="leveling-progress-card" title="Experience Progress">
        <div className="xp-progress-section">
          <div className="xp-info">
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
          <div className="xp-percent">{xpPercent}%</div>
        </div>
      </Card>

      <Card className="leveling-location-card">
        <div className="location-info">
          <AimOutlined className="location-icon" />
          <div className="location-details">
            <Text type="secondary">Current Location</Text>
            <Tag className="location-tag">{leveling.location}</Tag>
          </div>
        </div>
      </Card>
    </div>
  );
};
