import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Table, Typography, Spin } from 'antd';
import {
  RobotOutlined,
  PlayCircleOutlined,
  RiseOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { MetricCard } from '../../components/ui/MetricCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import type { Bot } from '../../types';
import { subscribeBotsList } from '../../services/botsApiService';
import styles from './Dashboard.module.css';

function cx(classNames: string): string {
  return classNames
    .split(' ')
    .filter(Boolean)
    .map((name) => styles[name] || name)
    .join(' ');
}

const { Title } = Typography;

interface BotData extends Bot {
  character: {
    name: string;
    level: number;
    race: string;
    class: string;
    server: string;
    faction: 'alliance' | 'horde';
  };
}

const columns = [
  {
    title: 'Name',
    dataIndex: 'character',
    key: 'name',
    render: (character: BotData['character'], record: BotData) => (
      <div>
        <div className={cx('bot-name')}>{character.name}</div>
        <div className={cx('bot-id')}>{record.id.substring(0, 8)}...</div>
      </div>
    ),
  },
  {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    render: (status: Bot['status']) => <StatusBadge status={status} size="small" />,
  },
  {
    title: 'Character',
    dataIndex: 'character',
    key: 'character',
    render: (character: BotData['character']) => (
      <div>
        <div className={cx('char-name')}>{character.name}</div>
        <div className={cx('char-info')}>Lv.{character.level} {character.race} {character.class}</div>
      </div>
    ),
  },
  {
    title: 'Server',
    dataIndex: ['character', 'server'],
    key: 'server',
  },
  {
    title: 'Project',
    dataIndex: 'project_id',
    key: 'project_id',
    render: (projectId: string) => projectId === 'wow_tbc' ? 'WoW TBC' : 'WoW Midnight',
  },
  {
    title: 'Last Seen',
    dataIndex: 'last_seen',
    key: 'last_seen',
    render: (timestamp: number) => {
      if (!timestamp) return 'Never';
      const date = new Date(timestamp);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const minutes = Math.floor(diff / 60000);
      
      if (minutes < 1) return 'Just now';
      if (minutes < 60) return `${minutes} min ago`;
      if (minutes < 1440) return `${Math.floor(minutes / 60)} hours ago`;
      return date.toLocaleDateString();
    },
  },
];

export const DashboardPage: React.FC = () => {
  const [bots, setBots] = useState<BotData[]>([]);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    totalBots: 0,
    activeBots: 0,
    levelingBots: 0,
    farmingBots: 0,
    bannedBots: 0,
  });

  // Загрузка ботов через backend API с polling-обновлениями
  useEffect(() => {
    return subscribeBotsList(
      (botsList) => {
        const botsArray = botsList as BotData[];
        setBots(botsArray);
        setMetrics({
          totalBots: botsArray.length,
          activeBots: botsArray.filter((bot) => ['prepare', 'leveling', 'profession', 'farming'].includes(bot.status))
            .length,
          levelingBots: botsArray.filter((bot) => bot.status === 'leveling').length,
          farmingBots: botsArray.filter((bot) => bot.status === 'farming').length,
          bannedBots: botsArray.filter((bot) => bot.status === 'banned').length,
        });
        setLoading(false);
      },
      (error) => {
        console.error('Error loading bots:', error);
        setLoading(false);
      },
      { intervalMs: 5000 }
    );
  }, []);

  if (loading) {
    return (
      <div className={cx('dashboard-page')}>
        <div className={cx('dashboard-loading')}>
          <Spin size="large" />
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cx('dashboard-page')}>
      <Title level={2} className={cx('page-title')}>
        Dashboard
      </Title>

      <Row gutter={[16, 16]} className={cx('metrics-row')}>
        <Col span={6}>
          <MetricCard
            label="Total Bots"
            value={metrics.totalBots}
            icon={<RobotOutlined />}
          />
        </Col>
        <Col span={6}>
          <MetricCard
            label="Active Bots"
            value={metrics.activeBots}
            icon={<PlayCircleOutlined />}
          />
        </Col>
        <Col span={6}>
          <MetricCard
            label="Leveling"
            value={metrics.levelingBots}
            icon={<RiseOutlined />}
          />
        </Col>
        <Col span={6}>
          <MetricCard
            label="Banned"
            value={metrics.bannedBots}
            icon={<WarningOutlined />}
          />
        </Col>
      </Row>

      <Card title={`Bot List (${bots.length})`} className={cx('bot-list-card')}>
        <Table
          dataSource={bots}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          size="small"
        />
      </Card>
    </div>
  );
};
