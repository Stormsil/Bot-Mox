import React from 'react';
import {
  Alert,
  Card,
  Col,
  Divider,
  Empty,
  List,
  Progress,
  Row,
  Statistic,
  Tag,
  Typography,
} from 'antd';
import {
  AimOutlined,
  BarChartOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  LineChartOutlined,
  RiseOutlined,
  ShoppingOutlined,
  StopOutlined,
  ThunderboltOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import {
  getProfessionColor,
  getProfessionIcon,
  getQualityColor,
  mockAnalytics,
  mockFarmStats,
  mockInventory,
  mockLeveling,
  mockProfessions,
} from './config';
import type { LifeStage } from './config';
import { SimpleBarChart } from './SimpleBarChart';

const { Text, Title } = Typography;

interface StagePanelsProps {
  currentStage: LifeStage;
  renderTimestamp: number;
  formatDuration: (ms: number) => string;
}

export const StagePanels: React.FC<StagePanelsProps> = ({ currentStage, renderTimestamp, formatDuration }) => {
  const renderPrepareContent = () => (
    <div className="stage-content prepare-content">
      {currentStage === 'banned' ? (
        <Alert
          message="Bot is Banned"
          description="This bot has been banned and moved to archive. You can unban it to restore functionality."
          type="error"
          showIcon
          icon={<StopOutlined />}
        />
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <div className="prepare-message">
              <Title level={4}>Bot is preparing</Title>
              <Text type="secondary">
                At this stage, the bot is undergoing initial setup before launch.
                Data will be available after transitioning to an active stage.
              </Text>
            </div>
          }
        />
      )}
    </div>
  );

  const renderLevelingContent = () => {
    const leveling = mockLeveling;
    const xpPercent = Math.round((leveling.current_xp / leveling.max_xp) * 100);
    const analytics = mockAnalytics.leveling;

    return (
      <div className="stage-content leveling-content">
        <Row gutter={[16, 16]}>
          <Col span={8}>
            <Card className="stage-stat-card">
              <Statistic
                title="Current Level"
                value={leveling.current_level}
                prefix={<RiseOutlined />}
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card className="stage-stat-card">
              <Statistic
                title="XP per Hour"
                value={leveling.xp_per_hour.toLocaleString()}
                suffix="XP"
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card className="stage-stat-card">
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

        <Card className="stage-detail-card" title="Experience Progress">
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

        <Card className="stage-detail-card" title="Current Location">
          <div className="location-info">
            <AimOutlined className="location-icon" />
            <div className="location-details">
              <Text type="secondary">Location</Text>
              <Tag className="location-tag">{leveling.location}</Tag>
            </div>
          </div>
        </Card>

        <Card className="stage-detail-card analytics-card" title="Leveling Analytics">
          <Row gutter={[16, 16]}>
            <Col span={8}>
              <Statistic
                title="Total Time"
                value={analytics.totalTime}
                suffix="h"
                prefix={<ClockCircleOutlined />}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="Levels Gained"
                value={analytics.levelsGained}
                prefix={<RiseOutlined />}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="Avg XP/h"
                value={analytics.avgXpPerHour.toLocaleString()}
                prefix={<LineChartOutlined />}
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

  const renderProfessionsContent = () => {
    const professions = mockProfessions;
    const analytics = mockAnalytics.professions;

    return (
      <div className="stage-content professions-content">
        <Row gutter={[16, 16]}>
          {professions.map((profession) => {
            const percent = profession.max_skill_points > 0
              ? Math.round((profession.skill_points / profession.max_skill_points) * 100)
              : 0;
            const color = getProfessionColor(profession.name);
            const isActive = profession.skill_points > 0;

            return (
              <Col span={12} key={profession.name}>
                <Card
                  className={`profession-card ${isActive ? 'active' : 'inactive'}`}
                  title={
                    <div className="profession-header">
                      <span className="profession-icon" style={{ color }}>
                        {getProfessionIcon(profession.name)}
                      </span>
                      <span className="profession-name">{profession.name}</span>
                      {isActive && <Tag color="success" className="profession-status">Active</Tag>}
                    </div>
                  }
                >
                  <div className="profession-progress">
                    <div className="skill-info">
                      <Text strong>{profession.skill_points}</Text>
                      <Text type="secondary">/ {profession.max_skill_points}</Text>
                    </div>
                    <Progress
                      percent={percent}
                      strokeColor={color}
                      trailColor="var(--boxmox-color-border-default)"
                      showInfo={false}
                    />
                    <div className="skill-percent">{percent}%</div>
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>

        <Card className="stage-detail-card analytics-card" title="Professions Analytics">
          <Row gutter={[16, 16]}>
            <Col span={8}>
              <Statistic
                title="Training Time"
                value={analytics.totalTime}
                suffix="h"
                prefix={<ClockCircleOutlined />}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="Skill Points"
                value={analytics.skillsGained}
                prefix={<ToolOutlined />}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="Avg Gain/h"
                value={analytics.avgSkillPerHour}
                prefix={<LineChartOutlined />}
              />
            </Col>
          </Row>
          <Divider />
          <SimpleBarChart
            data={analytics.trend}
            color="#13c2c2"
            label="Skill points trend"
          />
        </Card>
      </div>
    );
  };

  const renderFarmContent = () => {
    const inventory = mockInventory;
    const farmStats = mockFarmStats;
    const sessionDuration = renderTimestamp - farmStats.session_start;
    const analytics = mockAnalytics.farm;

    return (
      <div className="stage-content farm-content">
        <Row gutter={[16, 16]}>
          <Col span={8}>
            <Card className="stage-stat-card">
              <Statistic
                title="Total Gold"
                value={farmStats.total_gold.toLocaleString()}
                suffix="g"
                prefix={<DollarOutlined />}
                valueStyle={{ color: '#ffd700' }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card className="stage-stat-card">
              <Statistic
                title="Gold per Hour"
                value={farmStats.gold_per_hour.toFixed(1)}
                suffix="g/h"
                prefix={<ThunderboltOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card className="stage-stat-card">
              <Statistic
                title="Session Time"
                value={formatDuration(sessionDuration)}
                prefix={<ClockCircleOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
        </Row>

        <Card className="stage-detail-card" title="Inventory">
          <List
            dataSource={inventory}
            renderItem={(item) => (
              <List.Item className="inventory-item">
                <div className="inventory-item-info">
                  <ShoppingOutlined className="inventory-item-icon" />
                  <div className="inventory-item-details">
                    <Text strong style={{ color: getQualityColor(item.quality) }}>
                      {item.name}
                    </Text>
                    <Tag className="quality-tag" style={{ backgroundColor: getQualityColor(item.quality) }}>
                      {item.quality}
                    </Tag>
                  </div>
                </div>
                <Text className="inventory-item-quantity">x{item.quantity}</Text>
              </List.Item>
            )}
          />
        </Card>

        <Card className="stage-detail-card analytics-card" title="Farm Analytics">
          <Row gutter={[16, 16]}>
            <Col span={8}>
              <Statistic
                title="Farm Time"
                value={analytics.totalTime}
                suffix="h"
                prefix={<ClockCircleOutlined />}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="Total Gold"
                value={analytics.totalGold.toLocaleString()}
                suffix="g"
                prefix={<DollarOutlined />}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="Avg Income/h"
                value={analytics.avgGoldPerHour.toFixed(1)}
                suffix="g/h"
                prefix={<BarChartOutlined />}
              />
            </Col>
          </Row>
          <Divider />
          <SimpleBarChart
            data={analytics.trend}
            color="#faad14"
            label="Gold/hour trend"
          />
        </Card>
      </div>
    );
  };

  switch (currentStage) {
    case 'prepare':
      return renderPrepareContent();
    case 'leveling':
      return renderLevelingContent();
    case 'professions':
      return renderProfessionsContent();
    case 'farm':
      return renderFarmContent();
    default:
      return renderPrepareContent();
  }
};
