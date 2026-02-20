import { ClockCircleOutlined, LineChartOutlined, ToolOutlined } from '@ant-design/icons';
import { Card, Col, Divider, Progress, Row, Statistic, Tag, Typography } from 'antd';
import type React from 'react';
import { getProfessionColor, getProfessionIcon, mockAnalytics, mockProfessions } from './config';
import styles from './lifeStages.module.css';
import { SimpleBarChart } from './SimpleBarChart';

const { Text } = Typography;

export const StageProfessionsPanel: React.FC = () => {
  const professions = mockProfessions;
  const analytics = mockAnalytics.professions;

  return (
    <div className={styles['stage-content']}>
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
                  <div className={styles['profession-header']}>
                    <span className={styles['profession-icon']} style={{ color }}>
                      {getProfessionIcon(profession.name)}
                    </span>
                    <span className={styles['profession-name']}>{profession.name}</span>
                    {isActive && (
                      <Tag color="success" className={styles['profession-status']}>
                        Active
                      </Tag>
                    )}
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

      <Card
        className={[styles['stage-detail-card'], styles['analytics-card']].join(' ')}
        title={<span className={styles['detail-card-title']}>Professions Analytics</span>}
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
        <SimpleBarChart data={analytics.trend} color="#13c2c2" label="Skill points trend" />
      </Card>
    </div>
  );
};
