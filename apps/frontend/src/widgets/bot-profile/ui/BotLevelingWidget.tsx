import { AimOutlined, ClockCircleOutlined, RiseOutlined } from '@ant-design/icons';

import type React from 'react';
import { wowMetricColors } from '../../../features/wow-data/config/colors';
import type { Bot, LevelingProgress } from '../../../shared/types';
import {
  AppCard as Card,
  AppCol as Col,
  AppFlex as Flex,
  AppProgress as Progress,
  AppRow as Row,
  AppStatistic as Statistic,
  AppTag as Tag,
  AppTypography as Typography,
} from '../../../shared/ui';
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

export const BotLevelingWidget: React.FC<BotLevelingProps> = () => {
  const leveling = mockLeveling;
  const xpPercent = Math.round((leveling.current_xp / leveling.max_xp) * 100);

  return (
    <div className={styles['bot-leveling']}>
      <Row gutter={[16, 16]}>
        <Col span={8}>
          <Card className={styles['leveling-stat-card']}>
            <Statistic
              title={<span className={styles['stat-title']}>Current Level</span>}
              value={leveling.current_level}
              prefix={<RiseOutlined />}
              valueStyle={{
                color: wowMetricColors.levelingCurrent,
                fontSize: 'var(--text-xl)',
                fontWeight: 600,
              }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card className={styles['leveling-stat-card']}>
            <Statistic
              title={<span className={styles['stat-title']}>XP per Hour</span>}
              value={leveling.xp_per_hour.toLocaleString()}
              suffix="XP"
              valueStyle={{
                color: wowMetricColors.levelingXpPerHour,
                fontSize: 'var(--text-xl)',
                fontWeight: 600,
              }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card className={styles['leveling-stat-card']}>
            <Statistic
              title={<span className={styles['stat-title']}>Time to Level</span>}
              value={leveling.estimated_time_to_level}
              suffix="h"
              prefix={<ClockCircleOutlined />}
              valueStyle={{
                color: wowMetricColors.levelingTimeToLevel,
                fontSize: 'var(--text-xl)',
                fontWeight: 600,
              }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        className={styles['leveling-progress-card']}
        title={<span className={styles['card-title']}>Experience Progress</span>}
      >
        <div className={styles['xp-progress-section']}>
          <Flex justify="space-between" className={styles['xp-summary']}>
            <Text strong className={styles['text-primary']}>
              Level {leveling.current_level}
            </Text>
            <Text type="secondary" className={styles['text-primary']}>
              {leveling.current_xp.toLocaleString()} / {leveling.max_xp.toLocaleString()} XP
            </Text>
          </Flex>
          <Progress
            percent={xpPercent}
            strokeColor={wowMetricColors.levelingCurrent}
            trailColor="var(--botmox-color-border-default)"
            showInfo={false}
          />
          <div className={styles['xp-percent']}>{xpPercent}%</div>
        </div>
      </Card>

      <Card className={styles['leveling-location-card']}>
        <Flex align="center" gap={12} className={styles['location-row']}>
          <AimOutlined className={styles['location-icon']} />
          <Flex vertical gap={4} className={styles['location-content']}>
            <Text type="secondary" style={{ fontSize: 'var(--text-xs)' }}>
              Current Location
            </Text>
            <Tag className={styles['location-tag']}>{leveling.location}</Tag>
          </Flex>
        </Flex>
      </Card>
    </div>
  );
};
