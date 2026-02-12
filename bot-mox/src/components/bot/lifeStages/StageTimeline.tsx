import React from 'react';
import { Timeline, Typography } from 'antd';
import {
  CheckCircleOutlined,
  GoldOutlined,
  LoadingOutlined,
  RiseOutlined,
  StopOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import type { LifeStage } from './config';

const { Text } = Typography;

interface StageTimelineProps {
  currentStage: LifeStage;
}

export const StageTimeline: React.FC<StageTimelineProps> = ({ currentStage }) => (
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
          dot: currentStage === 'leveling' ? <RiseOutlined /> : (['professions', 'farm', 'banned'].includes(currentStage) ? <CheckCircleOutlined /> : null),
          color: currentStage === 'leveling' ? 'purple' : (['professions', 'farm', 'banned'].includes(currentStage) ? 'green' : 'gray'),
          children: (
            <div className={`timeline-item ${currentStage === 'leveling' ? 'active' : ''}`}>
              <Text strong>Leveling</Text>
              <br />
              <Text type="secondary">Level 1-70</Text>
            </div>
          ),
        },
        {
          dot: currentStage === 'professions' ? <ToolOutlined /> : (['farm', 'banned'].includes(currentStage) ? <CheckCircleOutlined /> : null),
          color: currentStage === 'professions' ? 'cyan' : (['farm', 'banned'].includes(currentStage) ? 'green' : 'gray'),
          children: (
            <div className={`timeline-item ${currentStage === 'professions' ? 'active' : ''}`}>
              <Text strong>Professions</Text>
              <br />
              <Text type="secondary">Skill development</Text>
            </div>
          ),
        },
        {
          dot: currentStage === 'farm' ? <GoldOutlined /> : (currentStage === 'banned' ? <CheckCircleOutlined /> : null),
          color: currentStage === 'farm' ? 'orange' : (currentStage === 'banned' ? 'green' : 'gray'),
          children: (
            <div className={`timeline-item ${currentStage === 'farm' ? 'active' : ''}`}>
              <Text strong>Farm</Text>
              <br />
              <Text type="secondary">Gold earning</Text>
            </div>
          ),
        },
        {
          dot: currentStage === 'banned' ? <StopOutlined /> : null,
          color: currentStage === 'banned' ? 'red' : 'gray',
          children: (
            <div className={`timeline-item ${currentStage === 'banned' ? 'active banned' : ''}`}>
              <Text strong style={{ color: currentStage === 'banned' ? '#ff4d4f' : undefined }}>Banned</Text>
              <br />
              <Text type="secondary">Archived</Text>
            </div>
          ),
        },
      ]}
    />
  </div>
);
