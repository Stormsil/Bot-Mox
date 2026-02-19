import { Alert, Spin } from 'antd';
import type React from 'react';
import styles from '../BotPage.module.css';

export const BotPageLoading: React.FC = () => (
  <div className={styles.root}>
    <div className={styles.loading}>
      <Spin size="large" />
      <p>Loading bot data...</p>
    </div>
  </div>
);

interface BotPageAlertStateProps {
  message: string;
  description: string;
}

export const BotPageAlertState: React.FC<BotPageAlertStateProps> = ({ message, description }) => (
  <div className={styles.root}>
    <Alert message={message} description={description} type="error" showIcon />
  </div>
);
