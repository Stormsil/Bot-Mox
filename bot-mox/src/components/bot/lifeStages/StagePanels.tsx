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
import styles from './lifeStages.module.css';

const { Text, Title } = Typography;

interface StagePanelsProps {
  currentStage: LifeStage;
  renderTimestamp: number;
  formatDuration: (ms: number) => string;
}

export const StagePanels: React.FC<StagePanelsProps> = ({ currentStage, renderTimestamp, formatDuration }) => {
  const stageCardStyles = {
    header: {
      background: 'var(--boxmox-color-surface-panel)',
      borderBottom: '1px solid var(--boxmox-color-border-default)',
    },
    title: { color: 'var(--boxmox-color-text-primary)' },
  };
  const statValueStyle = { color: 'var(--boxmox-color-text-primary)' };

  const renderPrepareContent = () => (
    <div className={[styles['stage-content'], styles['prepare-content']].join(' ')}>
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
            <div className={styles['prepare-message']}>
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
      <div className={[styles['stage-content'], styles['leveling-content']].filter(Boolean).join(' ')}>
        <Row gutter={[16, 16]}>
          <Col span={8}>
            <Card className={styles['stage-stat-card']}>
              <Statistic
                title="Current Level"
                value={leveling.current_level}
                prefix={<RiseOutlined />}
                valueStyle={{ ...statValueStyle, color: '#722ed1' }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card className={styles['stage-stat-card']}>
              <Statistic
                title="XP per Hour"
                value={leveling.xp_per_hour.toLocaleString()}
                suffix="XP"
                valueStyle={{ ...statValueStyle, color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card className={styles['stage-stat-card']}>
              <Statistic
                title="Time to Level"
                value={leveling.estimated_time_to_level}
                suffix="h"
                prefix={<ClockCircleOutlined />}
                valueStyle={{ ...statValueStyle, color: '#1890ff' }}
              />
            </Card>
          </Col>
        </Row>

        <Card className={styles['stage-detail-card']} title="Experience Progress" styles={stageCardStyles}>
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

        <Card className={styles['stage-detail-card']} title="Current Location" styles={stageCardStyles}>
          <div className={styles['location-info']}>
            <AimOutlined className={styles['location-icon']} />
            <div className={styles['location-details']}>
              <Text type="secondary">Location</Text>
              <Tag className={styles['location-tag']}>{leveling.location}</Tag>
            </div>
          </div>
        </Card>

        <Card className={[styles['stage-detail-card'], styles['analytics-card']].join(' ')} title="Leveling Analytics" styles={stageCardStyles}>
          <Row gutter={[16, 16]}>
            <Col span={8}>
              <Statistic
                title="Total Time"
                value={analytics.totalTime}
                suffix="h"
                prefix={<ClockCircleOutlined />}
                valueStyle={statValueStyle}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="Levels Gained"
                value={analytics.levelsGained}
                prefix={<RiseOutlined />}
                valueStyle={statValueStyle}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="Avg XP/h"
                value={analytics.avgXpPerHour.toLocaleString()}
                prefix={<LineChartOutlined />}
                valueStyle={statValueStyle}
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
      <div className={[styles['stage-content'], styles['professions-content']].filter(Boolean).join(' ')}>
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
                  className={[
                    styles['profession-card'],
                    isActive ? styles.active : styles.inactive,
                  ].join(' ')}
                  title={
                    <div className={styles['profession-header']}>
                      <span className={styles['profession-icon']} style={{ color }}>
                        {getProfessionIcon(profession.name)}
                      </span>
                      <span className={styles['profession-name']}>{profession.name}</span>
                      {isActive && <Tag color="success" className={styles['profession-status']}>Active</Tag>}
                    </div>
                  }
                >
                  <div className={styles['profession-progress']}>
                    <div className={styles['skill-info']}>
                      <Text strong>{profession.skill_points}</Text>
                      <Text type="secondary">/ {profession.max_skill_points}</Text>
                    </div>
                    <Progress
                      percent={percent}
                      strokeColor={color}
                      trailColor="var(--boxmox-color-border-default)"
                      showInfo={false}
                    />
                    <div className={styles['skill-percent']}>{percent}%</div>
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>

        <Card className={[styles['stage-detail-card'], styles['analytics-card']].join(' ')} title="Professions Analytics">
          <Row gutter={[16, 16]}>
            <Col span={8}>
              <Statistic
                title="Training Time"
                value={analytics.totalTime}
                suffix="h"
                prefix={<ClockCircleOutlined />}
                valueStyle={statValueStyle}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="Skill Points"
                value={analytics.skillsGained}
                prefix={<ToolOutlined />}
                valueStyle={statValueStyle}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="Avg Gain/h"
                value={analytics.avgSkillPerHour}
                prefix={<LineChartOutlined />}
                valueStyle={statValueStyle}
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
      <div className={[styles['stage-content'], styles['farm-content']].filter(Boolean).join(' ')}>
        <Row gutter={[16, 16]}>
          <Col span={8}>
            <Card className={styles['stage-stat-card']}>
              <Statistic
                title="Total Gold"
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
                title="Gold per Hour"
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
                title="Session Time"
                value={formatDuration(sessionDuration)}
                prefix={<ClockCircleOutlined />}
                valueStyle={{ ...statValueStyle, color: '#1890ff' }}
              />
            </Card>
          </Col>
        </Row>

        <Card className={styles['stage-detail-card']} title="Inventory" styles={stageCardStyles}>
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
                    <Tag className={styles['quality-tag']} style={{ backgroundColor: getQualityColor(item.quality) }}>
                      {item.quality}
                    </Tag>
                  </div>
                </div>
                <Text className={styles['inventory-item-quantity']}>x{item.quantity}</Text>
              </List.Item>
            )}
          />
        </Card>

        <Card className={[styles['stage-detail-card'], styles['analytics-card']].join(' ')} title="Farm Analytics" styles={stageCardStyles}>
          <Row gutter={[16, 16]}>
            <Col span={8}>
              <Statistic
                title="Farm Time"
                value={analytics.totalTime}
                suffix="h"
                prefix={<ClockCircleOutlined />}
                valueStyle={statValueStyle}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="Total Gold"
                value={analytics.totalGold.toLocaleString()}
                suffix="g"
                prefix={<DollarOutlined />}
                valueStyle={statValueStyle}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="Avg Income/h"
                value={analytics.avgGoldPerHour.toFixed(1)}
                suffix="g/h"
                prefix={<BarChartOutlined />}
                valueStyle={statValueStyle}
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

