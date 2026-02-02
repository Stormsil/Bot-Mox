import React, { useState, useEffect } from 'react';
import {
  Card,
  Select,
  Statistic,
  Row,
  Col,
  Typography,
  Tag,
  Progress,
  List,
  Empty,
  Spin,
  Alert,
  Divider,
  Timeline,
} from 'antd';
import {
  RiseOutlined,
  ToolOutlined,
  GoldOutlined,
  ClockCircleOutlined,
  AimOutlined,
  BuildOutlined,
  ExperimentOutlined,
  FireOutlined,
  DollarOutlined,
  ThunderboltOutlined,
  ShoppingOutlined,
  LineChartOutlined,
  BarChartOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import { ref, onValue, off } from 'firebase/database';
import { database } from '../../utils/firebase';
import type { Bot, InventoryItem, LevelingProgress, ProfessionProgress } from '../../types';
import './BotLifeStages.css';

const { Text, Title } = Typography;
const { Option } = Select;

// Life stage types
export type LifeStage = 'prepare' | 'leveling' | 'professions' | 'farm';

interface BotLifeStagesProps {
  bot: Bot;
  botId: string;
}

// Mock data for leveling
const mockLeveling: LevelingProgress = {
  current_level: 42,
  current_xp: 125000,
  max_xp: 180000,
  xp_per_hour: 8500,
  estimated_time_to_level: 6.5,
  location: 'Stranglethorn Vale',
};

// Mock data for professions
const mockProfessions: ProfessionProgress[] = [
  { name: 'Mining', level: 275, max_level: 375, skill_points: 275, max_skill_points: 375 },
  { name: 'Herbalism', level: 0, max_level: 375, skill_points: 0, max_skill_points: 375 },
  { name: 'Skinning', level: 0, max_level: 375, skill_points: 0, max_skill_points: 375 },
  { name: 'Engineering', level: 0, max_level: 375, skill_points: 0, max_skill_points: 375 },
];

// Mock data for inventory
const mockInventory: InventoryItem[] = [
  { id: '1', name: 'Runecloth', quantity: 120, quality: 'common' },
  { id: '2', name: 'Thorium Ore', quantity: 45, quality: 'uncommon' },
  { id: '3', name: 'Arcane Crystal', quantity: 3, quality: 'rare' },
  { id: '4', name: 'Black Lotus', quantity: 1, quality: 'epic' },
];

// Mock data for farm
const mockFarmStats = {
  total_gold: 15420,
  gold_per_hour: 125.5,
  session_start: Date.now() - 3600000 * 6,
};

// Mock data for analytics
const mockAnalytics = {
  leveling: {
    totalTime: 48,
    levelsGained: 42,
    avgXpPerHour: 8500,
    trend: [1200, 3500, 5800, 7200, 8500, 9200, 8800, 9000],
  },
  professions: {
    totalTime: 24,
    skillsGained: 275,
    avgSkillPerHour: 11.5,
    trend: [50, 120, 180, 220, 250, 275],
  },
  farm: {
    totalTime: 72,
    totalGold: 15420,
    avgGoldPerHour: 125.5,
    trend: [100, 110, 125, 130, 128, 125, 122, 125],
  },
};

const getProfessionIcon = (name: string) => {
  switch (name.toLowerCase()) {
    case 'mining':
      return <BuildOutlined />;
    case 'herbalism':
      return <ExperimentOutlined />;
    case 'skinning':
      return <FireOutlined />;
    default:
      return <ToolOutlined />;
  }
};

const getProfessionColor = (name: string) => {
  switch (name.toLowerCase()) {
    case 'mining':
      return '#8b4513';
    case 'herbalism':
      return '#228b22';
    case 'skinning':
      return '#cd853f';
    case 'engineering':
      return '#4682b4';
    default:
      return '#eb2f96';
  }
};

const getQualityColor = (quality: InventoryItem['quality']) => {
  switch (quality) {
    case 'common':
      return '#9ca3af';
    case 'uncommon':
      return '#22c55e';
    case 'rare':
      return '#3b82f6';
    case 'epic':
      return '#a855f7';
    default:
      return '#9ca3af';
  }
};

const getStageIcon = (stage: LifeStage) => {
  switch (stage) {
    case 'prepare':
      return <LoadingOutlined />;
    case 'leveling':
      return <RiseOutlined />;
    case 'professions':
      return <ToolOutlined />;
    case 'farm':
      return <GoldOutlined />;
  }
};

const getStageLabel = (stage: LifeStage) => {
  switch (stage) {
    case 'prepare':
      return 'Preparation';
    case 'leveling':
      return 'Leveling';
    case 'professions':
      return 'Professions';
    case 'farm':
      return 'Farm';
  }
};

const getStageColor = (stage: LifeStage) => {
  switch (stage) {
    case 'prepare':
      return '#8c8c8c';
    case 'leveling':
      return '#722ed1';
    case 'professions':
      return '#13c2c2';
    case 'farm':
      return '#faad14';
  }
};

export const BotLifeStages: React.FC<BotLifeStagesProps> = ({ bot, botId }) => {
  const [currentStage, setCurrentStage] = useState<LifeStage>('prepare');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load current status from Firebase
  useEffect(() => {
    const statusRef = ref(database, `bots/${botId}/status`);

    const handleValue = (snapshot: any) => {
      const status = snapshot.val();
      if (status) {
        // Map database status to stages
        const stageMap: Record<string, LifeStage> = {
          'prepare': 'prepare',
          'leveling': 'leveling',
          'profession': 'professions',
          'professions': 'professions',
          'farming': 'farm',
          'farm': 'farm',
        };
        setCurrentStage(stageMap[status] || 'prepare');
      }
      setLoading(false);
    };

    const handleError = (err: Error) => {
      console.error('Error loading bot status:', err);
      setError('Failed to load bot status');
      setLoading(false);
    };

    onValue(statusRef, handleValue, handleError);

    return () => {
      off(statusRef, 'value', handleValue);
    };
  }, [botId]);

  const handleStageChange = (value: LifeStage) => {
    setCurrentStage(value);
  };

  const formatDuration = (ms: number) => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

  // Simple bar chart component
  const SimpleBarChart: React.FC<{ data: number[]; color: string; label: string }> = ({
    data,
    color,
    label,
  }) => {
    const max = Math.max(...data);
    return (
      <div className="simple-bar-chart">
        <Text type="secondary" className="chart-label">{label}</Text>
        <div className="chart-bars">
          {data.map((value, index) => (
            <div
              key={index}
              className="chart-bar"
              style={{
                height: `${(value / max) * 100}%`,
                backgroundColor: color,
              }}
              title={`${value}`}
            />
          ))}
        </div>
      </div>
    );
  };

  // Render content for Prepare stage
  const renderPrepareContent = () => (
    <div className="stage-content prepare-content">
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
    </div>
  );

  // Render content for Leveling stage
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
              trailColor="var(--proxmox-border)"
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

  // Render content for Professions stage
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
                      trailColor="var(--proxmox-border)"
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

  // Render content for Farm stage
  const renderFarmContent = () => {
    const inventory = mockInventory;
    const farmStats = mockFarmStats;
    const sessionDuration = Date.now() - farmStats.session_start;
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

  // Render content based on selected stage
  const renderStageContent = () => {
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

  // Stage timeline
  const renderStageTimeline = () => (
    <div className="stage-timeline">
      <Timeline
        items={[
          {
            dot: currentStage === 'prepare' ? <LoadingOutlined /> : <CheckCircleOutlined />,
            color: currentStage === 'prepare' ? 'blue' : 'green',
            children: (
              <div className={`timeline-item ${currentStage === 'prepare' ? 'active' : ''}`}>
                <Text strong>Preparation</Text>
                <br />
                <Text type="secondary">Initial setup</Text>
              </div>
            ),
          },
          {
            dot: currentStage === 'leveling' ? <RiseOutlined /> : (['professions', 'farm'].includes(currentStage) ? <CheckCircleOutlined /> : null),
            color: currentStage === 'leveling' ? 'purple' : (['professions', 'farm'].includes(currentStage) ? 'green' : 'gray'),
            children: (
              <div className={`timeline-item ${currentStage === 'leveling' ? 'active' : ''}`}>
                <Text strong>Leveling</Text>
                <br />
                <Text type="secondary">Level 1-70</Text>
              </div>
            ),
          },
          {
            dot: currentStage === 'professions' ? <ToolOutlined /> : (currentStage === 'farm' ? <CheckCircleOutlined /> : null),
            color: currentStage === 'professions' ? 'cyan' : (currentStage === 'farm' ? 'green' : 'gray'),
            children: (
              <div className={`timeline-item ${currentStage === 'professions' ? 'active' : ''}`}>
                <Text strong>Professions</Text>
                <br />
                <Text type="secondary">Skill development</Text>
              </div>
            ),
          },
          {
            dot: currentStage === 'farm' ? <GoldOutlined /> : null,
            color: currentStage === 'farm' ? 'orange' : 'gray',
            children: (
              <div className={`timeline-item ${currentStage === 'farm' ? 'active' : ''}`}>
                <Text strong>Farm</Text>
                <br />
                <Text type="secondary">Gold earning</Text>
              </div>
            ),
          },
        ]}
      />
    </div>
  );

  if (loading) {
    return (
      <div className="bot-life-stages loading">
        <Spin size="large" />
        <p>Loading data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bot-life-stages">
        <Alert message="Error" description={error} type="error" showIcon />
      </div>
    );
  }

  return (
    <div className="bot-life-stages">
      <Card className="stage-selector-card">
        <div className="stage-selector-header">
          <div className="stage-selector-left">
            <Title level={5}>Life Stage</Title>
            <Select
              value={currentStage}
              onChange={handleStageChange}
              className="stage-select"
              popupClassName="stage-select-dropdown"
            >
              <Option value="prepare">
                <span className="stage-option">
                  <LoadingOutlined style={{ color: getStageColor('prepare') }} />
                  Preparation
                </span>
              </Option>
              <Option value="leveling">
                <span className="stage-option">
                  <RiseOutlined style={{ color: getStageColor('leveling') }} />
                  Leveling
                </span>
              </Option>
              <Option value="professions">
                <span className="stage-option">
                  <ToolOutlined style={{ color: getStageColor('professions') }} />
                  Professions
                </span>
              </Option>
              <Option value="farm">
                <span className="stage-option">
                  <GoldOutlined style={{ color: getStageColor('farm') }} />
                  Farm
                </span>
              </Option>
            </Select>
          </div>
          <div className="stage-indicator">
            <Tag
              icon={getStageIcon(currentStage)}
              color={getStageColor(currentStage)}
              className="current-stage-tag"
            >
              {getStageLabel(currentStage)}
            </Tag>
          </div>
        </div>
      </Card>

      <Row gutter={[16, 16]} className="stages-content-row">
        <Col span={18}>
          {renderStageContent()}
        </Col>
        <Col span={6}>
          <Card className="timeline-card" title="Life Cycle">
            {renderStageTimeline()}
          </Card>
        </Col>
      </Row>
    </div>
  );
};
