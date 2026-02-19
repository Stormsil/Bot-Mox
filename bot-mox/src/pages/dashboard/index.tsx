import {
  PlayCircleOutlined,
  RiseOutlined,
  RobotOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import type { TableColumnsType } from 'antd';
import { Card, Col, Row, Spin, Table, Typography } from 'antd';
import type React from 'react';
import { useEffect, useMemo } from 'react';
import { MetricCard } from '../../components/ui/MetricCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useBotsListQuery } from '../../entities/bot/api/useBotQueries';
import { uiLogger } from '../../observability/uiLogger';
import type { Bot } from '../../types';
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

const tableCellClassName = cx('bot-table-cell');

const columns: TableColumnsType<BotData> = [
  {
    title: 'Name',
    dataIndex: 'character',
    key: 'name',
    className: tableCellClassName,
    onHeaderCell: () => ({ className: cx('bot-table-header-cell') }),
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
    className: tableCellClassName,
    onHeaderCell: () => ({ className: cx('bot-table-header-cell') }),
    render: (status: Bot['status']) => <StatusBadge status={status} size="small" />,
  },
  {
    title: 'Character',
    dataIndex: 'character',
    key: 'character',
    className: tableCellClassName,
    onHeaderCell: () => ({ className: cx('bot-table-header-cell') }),
    render: (character: BotData['character']) => (
      <div>
        <div className={cx('char-name')}>{character.name}</div>
        <div className={cx('char-info')}>
          Lv.{character.level} {character.race} {character.class}
        </div>
      </div>
    ),
  },
  {
    title: 'Server',
    dataIndex: ['character', 'server'],
    key: 'server',
    className: tableCellClassName,
    onHeaderCell: () => ({ className: cx('bot-table-header-cell') }),
  },
  {
    title: 'Project',
    dataIndex: 'project_id',
    key: 'project_id',
    className: tableCellClassName,
    onHeaderCell: () => ({ className: cx('bot-table-header-cell') }),
    render: (projectId: string) => (projectId === 'wow_tbc' ? 'WoW TBC' : 'WoW Midnight'),
  },
  {
    title: 'Last Seen',
    dataIndex: 'last_seen',
    key: 'last_seen',
    className: tableCellClassName,
    onHeaderCell: () => ({ className: cx('bot-table-header-cell') }),
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
  const botsQuery = useBotsListQuery();
  const bots = useMemo(() => (botsQuery.data || []) as BotData[], [botsQuery.data]);
  const metrics = useMemo(
    () => ({
      totalBots: bots.length,
      activeBots: bots.filter((bot) =>
        ['prepare', 'leveling', 'profession', 'farming'].includes(bot.status),
      ).length,
      levelingBots: bots.filter((bot) => bot.status === 'leveling').length,
      farmingBots: bots.filter((bot) => bot.status === 'farming').length,
      bannedBots: bots.filter((bot) => bot.status === 'banned').length,
    }),
    [bots],
  );

  useEffect(() => {
    if (!botsQuery.error) {
      return;
    }
    uiLogger.error('Error loading bots:', botsQuery.error);
  }, [botsQuery.error]);

  if (botsQuery.isLoading) {
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
          <MetricCard label="Total Bots" value={metrics.totalBots} icon={<RobotOutlined />} />
        </Col>
        <Col span={6}>
          <MetricCard
            label="Active Bots"
            value={metrics.activeBots}
            icon={<PlayCircleOutlined />}
          />
        </Col>
        <Col span={6}>
          <MetricCard label="Leveling" value={metrics.levelingBots} icon={<RiseOutlined />} />
        </Col>
        <Col span={6}>
          <MetricCard label="Banned" value={metrics.bannedBots} icon={<WarningOutlined />} />
        </Col>
      </Row>

      <Card
        title={<span className={cx('bot-list-title')}>{`Bot List (${bots.length})`}</span>}
        className={cx('bot-list-card')}
        styles={{
          header: {
            background: 'var(--boxmox-color-surface-muted)',
            borderBottom: '1px solid var(--boxmox-color-border-default)',
          },
          body: { padding: 0 },
        }}
      >
        <Table
          dataSource={bots}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          size="small"
          className={cx('bot-table')}
          rowClassName={() => cx('bot-table-row')}
        />
      </Card>
    </div>
  );
};
