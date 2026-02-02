import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Table, Typography, Spin } from 'antd';
import {
  RobotOutlined,
  PlayCircleOutlined,
  RiseOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { ref, onValue, off } from 'firebase/database';
import { database } from '../../utils/firebase';
import { MetricCard } from '../../components/ui/MetricCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import type { Bot } from '../../types';
import './Dashboard.css';

const { Title } = Typography;

interface BotData extends Bot {
  character: {
    name: string;
    level: number;
    race: string;
    class: string;
    server: string;
  };
}

const columns = [
  {
    title: 'Name',
    dataIndex: 'character',
    key: 'name',
    render: (character: BotData['character'], record: BotData) => (
      <div>
        <div className="bot-name">{character.name}</div>
        <div className="bot-id">{record.id.substring(0, 8)}...</div>
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
        <div className="char-name">{character.name}</div>
        <div className="char-info">Lv.{character.level} {character.race} {character.class}</div>
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

  // Загрузка ботов из Firebase с realtime обновлениями
  useEffect(() => {
    setLoading(true);
    const botsRef = ref(database, 'bots');

    const handleValue = (snapshot: any) => {
      const data = snapshot.val();
      if (data) {
        const botsArray = Object.entries(data).map(([id, bot]: [string, any]) => ({
          id,
          ...bot,
        })) as BotData[];
        
        setBots(botsArray);
        
        // Calculate metrics
        setMetrics({
          totalBots: botsArray.length,
          activeBots: botsArray.filter(b => ['prepare', 'leveling', 'profession', 'farming'].includes(b.status)).length,
          levelingBots: botsArray.filter(b => b.status === 'leveling').length,
          farmingBots: botsArray.filter(b => b.status === 'farming').length,
          bannedBots: botsArray.filter(b => b.status === 'banned').length,
        });
      } else {
        setBots([]);
        setMetrics({
          totalBots: 0,
          activeBots: 0,
          levelingBots: 0,
          farmingBots: 0,
          bannedBots: 0,
        });
      }
      setLoading(false);
    };

    const handleError = (error: Error) => {
      console.error('Error loading bots:', error);
      setLoading(false);
    };

    onValue(botsRef, handleValue, handleError);

    return () => {
      off(botsRef, 'value', handleValue);
    };
  }, []);

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-loading">
          <Spin size="large" />
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <Title level={2} className="page-title">
        Dashboard
      </Title>

      <Row gutter={[16, 16]} className="metrics-row">
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

      <Card title={`Bot List (${bots.length})`} className="bot-list-card">
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
