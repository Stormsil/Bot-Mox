import { DownloadOutlined } from '@ant-design/icons';
import { Button, Card, List, Tag, Typography } from 'antd';
import type React from 'react';
import { useState } from 'react';
import type { Bot, LogEntry, LogEventType } from '../../types';
import styles from './BotLogs.module.css';

const { Text } = Typography;

interface BotLogsProps {
  bot: Bot;
}

// Моковые данные логов - только важные события
const mockLogs: LogEntry[] = [
  {
    id: '1',
    bot_id: 'bot_101',
    type: 'level_up',
    message: 'Level up: 67 -> 68',
    timestamp: Date.now() - 86400000,
    details: { old_level: 67, new_level: 68 },
  },
  {
    id: '2',
    bot_id: 'bot_101',
    type: 'death',
    message: 'Died in Shadowmoon Valley',
    timestamp: Date.now() - 172800000,
    details: { location: 'Shadowmoon Valley' },
  },
  {
    id: '3',
    bot_id: 'bot_101',
    type: 'level_up',
    message: 'Level up: 66 -> 67',
    timestamp: Date.now() - 259200000,
    details: { old_level: 66, new_level: 67 },
  },
];

const getEventColor = (type: LogEventType) => {
  switch (type) {
    case 'ban':
      return '#f5222d';
    case 'level_up':
      return '#52c41a';
    case 'death':
      return '#fa8c16';
    default:
      return '#8c8c8c';
  }
};

const getEventLabel = (type: LogEventType) => {
  switch (type) {
    case 'ban':
      return 'BAN';
    case 'level_up':
      return 'LEVEL UP';
    case 'death':
      return 'DEATH';
    default:
      return String(type).toUpperCase();
  }
};

const formatTime = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleString('ru-RU', { hour12: false });
};

export const BotLogs: React.FC<BotLogsProps> = ({ bot }) => {
  const [logs] = useState<LogEntry[]>(mockLogs);

  const handleExport = () => {
    const logText = logs
      .map((log) => `[${formatTime(log.timestamp)}] [${log.type.toUpperCase()}] ${log.message}`)
      .join('\n');
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bot-${bot.id}-logs.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles['bot-logs']}>
      <Card
        className={styles['logs-card']}
        title="Important Events"
        styles={{
          header: {
            background: 'var(--boxmox-color-surface-muted)',
            borderColor: 'var(--boxmox-color-border-default)',
          },
          title: {
            color: 'var(--boxmox-color-text-primary)',
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
          },
        }}
        extra={
          <Button type="text" size="small" icon={<DownloadOutlined />} onClick={handleExport}>
            Export
          </Button>
        }
      >
        <List
          dataSource={logs}
          renderItem={(log) => (
            <List.Item className={styles['log-entry']}>
              <div className={styles['log-timestamp']}>{formatTime(log.timestamp)}</div>
              <Tag
                className={styles['log-type-tag']}
                style={{
                  backgroundColor: `${getEventColor(log.type)}20`,
                  borderColor: getEventColor(log.type),
                  color: getEventColor(log.type),
                }}
              >
                {getEventLabel(log.type)}
              </Tag>
              <Text className={styles['log-message']}>{log.message}</Text>
            </List.Item>
          )}
          locale={{ emptyText: 'No important events' }}
        />
      </Card>
    </div>
  );
};
