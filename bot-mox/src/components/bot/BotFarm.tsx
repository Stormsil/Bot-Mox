import React from 'react';
import { Card, Statistic, Row, Col, Typography, Tag, List } from 'antd';
import { DollarOutlined, ClockCircleOutlined, ThunderboltOutlined, ShoppingOutlined } from '@ant-design/icons';
import type { Bot, InventoryItem } from '../../types';
import './BotFarm.css';

const { Text } = Typography;

interface BotFarmProps {
  bot: Bot;
}

// Моковые данные инвентаря
const mockInventory: InventoryItem[] = [
  { id: '1', name: 'Runecloth', quantity: 120, quality: 'common' },
  { id: '2', name: 'Thorium Ore', quantity: 45, quality: 'uncommon' },
  { id: '3', name: 'Arcane Crystal', quantity: 3, quality: 'rare' },
  { id: '4', name: 'Black Lotus', quantity: 1, quality: 'epic' },
];

// Моковые данные фарма
const mockFarmStats = {
  total_gold: 15420,
  gold_per_hour: 125.5,
  session_start: Date.now() - 3600000 * 6, // 6 hours ago
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

export const BotFarm: React.FC<BotFarmProps> = () => {
  const inventory = mockInventory;
  const farmStats = mockFarmStats;
  const sessionDuration = Date.now() - farmStats.session_start;
  const hoursActive = sessionDuration / 3600000;
  // goldEarned will be used in future
  void hoursActive;

  const formatDuration = (ms: number) => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="bot-farm">
      <Row gutter={[16, 16]}>
        <Col span={8}>
          <Card className="farm-stat-card">
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
          <Card className="farm-stat-card">
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
          <Card className="farm-stat-card">
            <Statistic
              title="Session Time"
              value={formatDuration(sessionDuration)}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
      </Row>

      <Card className="inventory-card" title="Inventory">
        <List
          dataSource={inventory}
          renderItem={(item) => (
            <List.Item className="inventory-item">
              <div className="inventory-item-info">
                <ShoppingOutlined className="inventory-item-icon" />
                <Text className="inventory-item-name" style={{ color: getQualityColor(item.quality) }}>
                  {item.name}
                </Text>
              </div>
              <Tag className="inventory-item-quantity">x{item.quantity}</Tag>
            </List.Item>
          )}
        />
      </Card>
    </div>
  );
};
