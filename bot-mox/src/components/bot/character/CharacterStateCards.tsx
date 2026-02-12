import React from 'react';
import { Alert, Button, Card, Spin, Typography } from 'antd';

const { Text } = Typography;

export const CharacterLoadingCard: React.FC = () => (
  <div className="bot-character">
    <Card className="character-card">
      <div className="loading-container">
        <Spin size="large" />
        <Text className="loading-text">Loading character data...</Text>
      </div>
    </Card>
  </div>
);

interface CharacterErrorCardProps {
  error: string;
}

export const CharacterErrorCard: React.FC<CharacterErrorCardProps> = ({ error }) => (
  <div className="bot-character">
    <Card className="character-card">
      <Alert
        message="Error"
        description={error}
        type="error"
        showIcon
        action={
          <Button size="small" onClick={() => window.location.reload()}>
            Retry
          </Button>
        }
      />
    </Card>
  </div>
);
