import { StopOutlined } from '@ant-design/icons';

import type React from 'react';
import {
  AppAlert as Alert,
  AppEmpty as Empty,
  AppFlex as Flex,
  AppTypography as Typography,
} from '../../../../shared/ui';
import styles from './lifeStages.module.css';

const { Text, Title } = Typography;

interface StagePreparePanelProps {
  isBanned: boolean;
}

export const StagePreparePanel: React.FC<StagePreparePanelProps> = ({ isBanned }) => (
  <Flex
    className={[styles['stage-content'], styles['prepare-content']].join(' ')}
    align="center"
    justify="center"
  >
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
  </Flex>
);
