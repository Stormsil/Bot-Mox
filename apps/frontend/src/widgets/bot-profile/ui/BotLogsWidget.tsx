import { DownloadOutlined } from '@ant-design/icons';

import type React from 'react';
import { useState } from 'react';
import { subtractNow } from '../../../shared/lib/date';
import type { Bot, LogEntry, LogEventType } from '../../../shared/types';
import {
  AppButton as Button,
  AppCard as Card,
  AppList as List,
  AppTag as Tag,
  AppTypography as Typography,
} from '../../../shared/ui';
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
    timestamp: subtractNow(1, 'day'),
    details: { old_level: 67, new_level: 68 },
  },
  {
    id: '2',
    bot_id: 'bot_101',
    type: 'death',
    message: 'Died in Shadowmoon Valley',
    timestamp: subtractNow(2, 'day'),
    details: { location: 'Shadowmoon Valley' },
  },
  {
    id: '3',
    bot_id: 'bot_101',
    type: 'level_up',
    message: 'Level up: 66 -> 67',
    timestamp: subtractNow(3, 'day'),
    details: { old_level: 66, new_level: 67 },
  },
];

const getEventColor = (type: LogEventType) => {
  switch (type) {
    case 'ban':
      return 'var(--boxmox-color-status-danger)';
    case 'level_up':
      return 'var(--boxmox-color-status-success)';
    case 'death':
      return 'var(--boxmox-color-status-warning)';
    default:
      return 'var(--boxmox-color-status-neutral)';
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

export const BotLogsWidget: React.FC<BotLogsProps> = ({ bot }) => {
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
        extra={
          <Button type="text" size="small" icon={<DownloadOutlined />} onClick={handleExport}>
            Export
          </Button>
        }
      >
        <List
          dataSource={logs}
          renderItem={(log) => {
            const eventColor = getEventColor(log.type);
            return (
              <List.Item className={styles['log-entry']}>
                <div className={styles['log-timestamp']}>{formatTime(log.timestamp)}</div>
                <Tag
                  className={styles['log-type-tag']}
                  style={{
                    backgroundColor: `color-mix(in srgb, ${eventColor} 14%, transparent)`,
                    borderColor: eventColor,
                    color: eventColor,
                  }}
                >
                  {getEventLabel(log.type)}
                </Tag>
                <Text className={styles['log-message']}>{log.message}</Text>
              </List.Item>
            );
          }}
          locale={{ emptyText: 'No important events' }}
        />
      </Card>
    </div>
  );
};
