import { ClockCircleOutlined, LineChartOutlined, ToolOutlined } from '@ant-design/icons';

import type React from 'react';
import { wowLifeStageColors } from '../../../../features/wow-data/config/colors';
import {
  AppCard as Card,
  AppCol as Col,
  AppDivider as Divider,
  AppFlex as Flex,
  AppProgress as Progress,
  AppRow as Row,
  AppStatistic as Statistic,
  AppTag as Tag,
  AppTypography as Typography,
} from '../../../../shared/ui';
import { getProfessionColor, getProfessionIcon, mockAnalytics, mockProfessions } from './config';
import styles from './lifeStages.module.css';
import { SimpleBarChart } from './SimpleBarChart';

const { Text } = Typography;

export const StageProfessionsPanel: React.FC = () => {
  const professions = mockProfessions;
  const analytics = mockAnalytics.professions;

  return (
    <Flex vertical className={styles['stage-content']}>
      <Row gutter={[16, 16]}>
        {professions.map((profession) => {
          const percent =
            profession.max_skill_points > 0
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
                  <Flex className={styles['profession-header']} align="center" gap={8}>
                    <span className={styles['profession-icon']} style={{ color }}>
                      {getProfessionIcon(profession.name)}
                    </span>
                    <span className={styles['profession-name']}>{profession.name}</span>
                    {isActive && (
                      <Tag color="success" className={styles['profession-status']}>
                        Active
                      </Tag>
                    )}
                  </Flex>
                }
              >
                <Flex vertical className={styles['profession-progress']}>
                  <Flex className={styles['skill-info']} justify="space-between">
                    <Text strong>{profession.skill_points}</Text>
                    <Text type="secondary">/ {profession.max_skill_points}</Text>
                  </Flex>
                  <Progress
                    percent={percent}
                    strokeColor={color}
                    trailColor="var(--boxmox-color-border-default)"
                    showInfo={false}
                  />
                  <div className={styles['skill-percent']}>{percent}%</div>
                </Flex>
              </Card>
            </Col>
          );
        })}
      </Row>

      <Card
        className={[styles['stage-detail-card'], styles['analytics-card']].join(' ')}
        title={<span className={styles['detail-card-title']}>Professions Analytics</span>}
      >
        <Row gutter={[16, 16]}>
          <Col span={8}>
            <Statistic
              title={<span className={styles['stat-title']}>Training Time</span>}
              value={analytics.totalTime}
              suffix="h"
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: 'var(--boxmox-color-text-primary)' }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title={<span className={styles['stat-title']}>Skill Points</span>}
              value={analytics.skillsGained}
              prefix={<ToolOutlined />}
              valueStyle={{ color: 'var(--boxmox-color-text-primary)' }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title={<span className={styles['stat-title']}>Avg Gain/h</span>}
              value={analytics.avgSkillPerHour}
              prefix={<LineChartOutlined />}
              valueStyle={{ color: 'var(--boxmox-color-text-primary)' }}
            />
          </Col>
        </Row>
        <Divider />
        <SimpleBarChart
          data={analytics.trend}
          color={wowLifeStageColors.professions}
          label="Skill points trend"
        />
      </Card>
    </Flex>
  );
};
