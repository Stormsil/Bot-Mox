import React from 'react';
import { Alert, Spin } from 'antd';

export const BotPageLoading: React.FC = () => (
  <div className="bot-page">
    <div className="bot-page-loading">
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
  <div className="bot-page">
    <Alert message={message} description={description} type="error" showIcon />
  </div>
);
