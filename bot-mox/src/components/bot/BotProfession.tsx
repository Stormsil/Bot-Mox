import { BuildOutlined, ExperimentOutlined, FireOutlined, ToolOutlined } from '@ant-design/icons';
import { Card, Col, Progress, Row, Tag, Typography } from 'antd';
import type React from 'react';
import type { Bot, ProfessionProgress } from '../../types';
import styles from './BotProfession.module.css';

const { Text } = Typography;

interface BotProfessionProps {
  bot: Bot;
}

// Моковые данные профессий
const mockProfessions: ProfessionProgress[] = [
  { name: 'Mining', level: 275, max_level: 375, skill_points: 275, max_skill_points: 375 },
  { name: 'Herbalism', level: 0, max_level: 375, skill_points: 0, max_skill_points: 375 },
  { name: 'Skinning', level: 0, max_level: 375, skill_points: 0, max_skill_points: 375 },
  { name: 'Engineering', level: 0, max_level: 375, skill_points: 0, max_skill_points: 375 },
];

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

export const BotProfession: React.FC<BotProfessionProps> = () => {
  const professions = mockProfessions;

  return (
    <div className={styles['bot-profession']}>
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
                styles={{
                  header: {
                    background: 'var(--boxmox-color-surface-muted)',
                    borderColor: 'var(--boxmox-color-border-default)',
                    padding: '12px 16px',
                    minHeight: 'auto',
                  },
                  body: {
                    padding: 16,
                  },
                }}
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
                    <Text strong style={{ color: 'var(--boxmox-color-text-primary)' }}>
                      {profession.skill_points}
                    </Text>
                    <Text type="secondary" style={{ color: 'var(--boxmox-color-text-primary)' }}>
                      / {profession.max_skill_points}
                    </Text>
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
    </div>
  );
};
