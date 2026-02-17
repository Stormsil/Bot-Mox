import React from 'react';
import { Alert, Button, Card, Spin, Typography } from 'antd';
import styles from './character.module.css';

const { Text } = Typography;

export const CharacterLoadingCard: React.FC = () => (
  <div className={styles['bot-character']}>
    <Card
      className={styles['character-card']}
      headStyle={{
        background: 'var(--boxmox-color-surface-muted)',
        borderColor: 'var(--boxmox-color-border-default)',
      }}
      bodyStyle={{ padding: 16 }}
    >
      <div className={styles['loading-container']}>
        <Spin size="large" />
        <Text className={styles['loading-text']}>Loading character data...</Text>
      </div>
    </Card>
  </div>
);

interface CharacterErrorCardProps {
  error: string;
}

export const CharacterErrorCard: React.FC<CharacterErrorCardProps> = ({ error }) => (
  <div className={styles['bot-character']}>
    <Card
      className={styles['character-card']}
      headStyle={{
        background: 'var(--boxmox-color-surface-muted)',
        borderColor: 'var(--boxmox-color-border-default)',
      }}
      bodyStyle={{ padding: 16 }}
    >
      <Alert
        message="Error"
        description={error}
        type="error"
        showIcon
        style={{
          background: 'color-mix(in srgb, var(--boxmox-color-status-danger) 10%, var(--boxmox-color-surface-muted))',
          borderColor: 'var(--boxmox-color-status-danger)',
        }}
        action={
          <Button size="small" onClick={() => window.location.reload()}>
            Retry
          </Button>
        }
      />
    </Card>
  </div>
);
