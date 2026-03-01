import { StopOutlined } from '@ant-design/icons';
import { Alert, Empty, Typography } from 'antd';
import type React from 'react';
import styles from './lifeStages.module.css';

const { Text, Title } = Typography;

interface StagePreparePanelProps {
  isBanned: boolean;
}

export const StagePreparePanel: React.FC<StagePreparePanelProps> = ({ isBanned }) => (
  <div className={[styles['stage-content'], styles['prepare-content']].join(' ')}>
    {isBanned ? (
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
              At this stage, the bot is undergoing initial setup before launch. Data will be
              available after transitioning to an active stage.
            </Text>
          </div>
        }
      />
    )}
  </div>
);
