import {
  ClockCircleOutlined,
  DollarOutlined,
  ShoppingOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';

import type React from 'react';
import { getWowRarityColor, wowMetricColors } from '../../../features/wow-data/config/colors';
import { formatDurationHoursMinutes, subtractNow } from '../../../shared/lib/date';
import { useCurrentTime } from '../../../shared/lib/hooks/useCurrentTime';
import type { Bot, InventoryItem } from '../../../shared/types';
import {
  AppCard as Card,
  AppCol as Col,
  AppList as List,
  AppRow as Row,
  AppStatistic as Statistic,
  AppTag as Tag,
  AppTypography as Typography,
} from '../../../shared/ui';
import styles from './BotFarm.module.css';

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
  session_start: subtractNow(6, 'hour'),
};

export const BotFarm: React.FC<BotFarmProps> = () => {
  const inventory = mockInventory;
  const farmStats = mockFarmStats;
  const currentTime = useCurrentTime();
  const sessionDuration = currentTime - farmStats.session_start;

  return (
    <div className={styles['bot-farm']}>
      <Row gutter={[16, 16]}>
        <Col span={8}>
          <Card className={styles['farm-stat-card']}>
            <Statistic
              title={<span className={styles.farmStatTitle}>Total Gold</span>}
              value={farmStats.total_gold.toLocaleString()}
              suffix="g"
              prefix={<DollarOutlined />}
              valueStyle={{
                color: wowMetricColors.farmGold,
                fontSize: 'var(--text-xl)',
                fontWeight: 600,
              }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card className={styles['farm-stat-card']}>
            <Statistic
              title={<span className={styles.farmStatTitle}>Gold per Hour</span>}
              value={farmStats.gold_per_hour.toFixed(1)}
              suffix="g/h"
              prefix={<ThunderboltOutlined />}
              valueStyle={{
                color: wowMetricColors.farmGoldPerHour,
                fontSize: 'var(--text-xl)',
                fontWeight: 600,
              }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card className={styles['farm-stat-card']}>
            <Statistic
              title={<span className={styles.farmStatTitle}>Session Time</span>}
              value={formatDurationHoursMinutes(sessionDuration)}
              prefix={<ClockCircleOutlined />}
              valueStyle={{
                color: wowMetricColors.farmSessionTime,
                fontSize: 'var(--text-xl)',
                fontWeight: 600,
              }}
            />
          </Card>
        </Col>
      </Row>

      <Card className={styles['inventory-card']} title="Inventory">
        <List
          dataSource={inventory}
          renderItem={(item) => (
            <List.Item className={styles['inventory-item']}>
              <div className={styles['inventory-item-info']}>
                <ShoppingOutlined className={styles['inventory-item-icon']} />
                <Text
                  className={styles['inventory-item-name']}
                  style={{ color: getWowRarityColor(item.quality) }}
                >
                  {item.name}
                </Text>
              </div>
              <Tag className={styles['inventory-item-quantity']}>x{item.quantity}</Tag>
            </List.Item>
          )}
        />
      </Card>
    </div>
  );
};
