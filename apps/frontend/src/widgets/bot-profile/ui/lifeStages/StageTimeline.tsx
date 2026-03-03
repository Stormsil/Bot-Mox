import {
  CheckCircleOutlined,
  GoldOutlined,
  LoadingOutlined,
  RiseOutlined,
  StopOutlined,
  ToolOutlined,
} from '@ant-design/icons';

import type React from 'react';
import { wowLifeStageColors } from '../../../../features/wow-data/config/colors';
import {
  AppFlex as Flex,
  AppTimeline as Timeline,
  AppTypography as Typography,
} from '../../../../shared/ui';
import type { LifeStage } from './config';
import styles from './lifeStages.module.css';

const { Text } = Typography;

interface StageTimelineProps {
  currentStage: LifeStage;
}

export const StageTimeline: React.FC<StageTimelineProps> = ({ currentStage }) => (
  <Flex vertical className={styles['stage-timeline']}>
    <Timeline
      style={{ paddingLeft: 8 }}
      items={[
        {
          dot: currentStage === 'prepare' ? <LoadingOutlined /> : <CheckCircleOutlined />,
          color: currentStage === 'prepare' ? wowLifeStageColors.prepare : 'green',
          children: (
            <div
              className={[
                styles['timeline-item'],
                styles['timeline-item-content'],
                currentStage === 'prepare' ? styles.active : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <Text
                strong
                style={
                  currentStage === 'prepare'
                    ? { color: 'var(--botmox-color-brand-primary)' }
                    : undefined
                }
              >
                Preparation
              </Text>
              <br />
              <Text
                type="secondary"
                style={
                  currentStage === 'prepare'
                    ? { color: 'var(--botmox-color-brand-primary)' }
                    : undefined
                }
              >
                Initial setup
              </Text>
            </div>
          ),
        },
        {
          dot:
            currentStage === 'leveling' ? (
              <RiseOutlined />
            ) : ['professions', 'farm', 'banned'].includes(currentStage) ? (
              <CheckCircleOutlined />
            ) : null,
          color:
            currentStage === 'leveling'
              ? wowLifeStageColors.leveling
              : ['professions', 'farm', 'banned'].includes(currentStage)
                ? 'green'
                : 'gray',
          children: (
            <div
              className={[
                styles['timeline-item'],
                styles['timeline-item-content'],
                currentStage === 'leveling' ? styles.active : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <Text
                strong
                style={
                  currentStage === 'leveling'
                    ? { color: 'var(--botmox-color-brand-primary)' }
                    : undefined
                }
              >
                Leveling
              </Text>
              <br />
              <Text
                type="secondary"
                style={
                  currentStage === 'leveling'
                    ? { color: 'var(--botmox-color-brand-primary)' }
                    : undefined
                }
              >
                Level 1-70
              </Text>
            </div>
          ),
        },
        {
          dot:
            currentStage === 'professions' ? (
              <ToolOutlined />
            ) : ['farm', 'banned'].includes(currentStage) ? (
              <CheckCircleOutlined />
            ) : null,
          color:
            currentStage === 'professions'
              ? wowLifeStageColors.professions
              : ['farm', 'banned'].includes(currentStage)
                ? 'green'
                : 'gray',
          children: (
            <div
              className={[
                styles['timeline-item'],
                styles['timeline-item-content'],
                currentStage === 'professions' ? styles.active : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <Text
                strong
                style={
                  currentStage === 'professions'
                    ? { color: 'var(--botmox-color-brand-primary)' }
                    : undefined
                }
              >
                Professions
              </Text>
              <br />
              <Text
                type="secondary"
                style={
                  currentStage === 'professions'
                    ? { color: 'var(--botmox-color-brand-primary)' }
                    : undefined
                }
              >
                Skill development
              </Text>
            </div>
          ),
        },
        {
          dot:
            currentStage === 'farm' ? (
              <GoldOutlined />
            ) : currentStage === 'banned' ? (
              <CheckCircleOutlined />
            ) : null,
          color:
            currentStage === 'farm'
              ? wowLifeStageColors.farm
              : currentStage === 'banned'
                ? 'green'
                : 'gray',
          children: (
            <div
              className={[
                styles['timeline-item'],
                styles['timeline-item-content'],
                currentStage === 'farm' ? styles.active : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <Text
                strong
                style={
                  currentStage === 'farm'
                    ? { color: 'var(--botmox-color-brand-primary)' }
                    : undefined
                }
              >
                Farm
              </Text>
              <br />
              <Text
                type="secondary"
                style={
                  currentStage === 'farm'
                    ? { color: 'var(--botmox-color-brand-primary)' }
                    : undefined
                }
              >
                Gold earning
              </Text>
            </div>
          ),
        },
        {
          dot: currentStage === 'banned' ? <StopOutlined /> : null,
          color: currentStage === 'banned' ? wowLifeStageColors.banned : 'gray',
          children: (
            <div
              className={[
                styles['timeline-item'],
                styles['timeline-item-content'],
                currentStage === 'banned' ? styles.active : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <Text
                strong
                style={currentStage === 'banned' ? { color: wowLifeStageColors.banned } : undefined}
              >
                Banned
              </Text>
              <br />
              <Text
                type="secondary"
                style={currentStage === 'banned' ? { color: wowLifeStageColors.banned } : undefined}
              >
                Archived
              </Text>
            </div>
          ),
        },
      ]}
    />
  </Flex>
);
