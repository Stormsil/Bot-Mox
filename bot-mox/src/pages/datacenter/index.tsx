import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Table, Typography, Tag, Progress, Alert, Spin, List } from 'antd';
import {
  DatabaseOutlined,
  DesktopOutlined,
  UserOutlined,
  DollarOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  KeyOutlined,
  GlobalOutlined,
  CreditCardOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { ref, onValue } from 'firebase/database';
import { database } from '../../utils/firebase';
import { MetricCard } from '../../components/ui/MetricCard';
import { ContentPanel } from '../../components/layout/ContentPanel';
import type { Bot, BotLicense, Proxy, Subscription } from '../../types';
import dayjs from 'dayjs';
import './DatacenterPage.css';

const { Title, Text } = Typography;

interface DashboardStats {
  totalBots: number;
  activeBots: number;
  offlineBots: number;
  bannedBots: number;
  totalLicenses: number;
  activeLicenses: number;
  expiredLicenses: number;
  totalProxies: number;
  activeProxies: number;
  expiredProxies: number;
  totalSubscriptions: number;
  activeSubscriptions: number;
  expiredSubscriptions: number;
  expiringSoonCount: number;
}

interface ExpiringItem {
  id: string;
  type: 'license' | 'proxy' | 'subscription';
  name: string;
  botId?: string;
  botName?: string;
  expiresAt: number;
  daysRemaining: number;
}

export const DatacenterPage: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [expiringItems, setExpiringItems] = useState<ExpiringItem[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [bots, setBots] = useState<Record<string, Bot>>({});

  useEffect(() => {
    const botsRef = ref(database, 'bots');
    const licensesRef = ref(database, 'bot_licenses');
    const proxiesRef = ref(database, 'proxies');
    const subscriptionsRef = ref(database, 'subscriptions');

    // Загрузка ботов
    const unsubscribeBots = onValue(botsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setBots(data);
        
        const botsList = Object.values(data) as Bot[];
        const now = Date.now();
        const fiveMinutesAgo = now - 5 * 60 * 1000;
        
        const newStats: DashboardStats = {
          totalBots: botsList.length,
          activeBots: botsList.filter(b => b.last_seen > fiveMinutesAgo && b.status !== 'banned').length,
          offlineBots: botsList.filter(b => b.last_seen <= fiveMinutesAgo && b.status !== 'banned').length,
          bannedBots: botsList.filter(b => b.status === 'banned').length,
          totalLicenses: 0,
          activeLicenses: 0,
          expiredLicenses: 0,
          totalProxies: 0,
          activeProxies: 0,
          expiredProxies: 0,
          totalSubscriptions: 0,
          activeSubscriptions: 0,
          expiredSubscriptions: 0,
          expiringSoonCount: 0,
        };

        // Загрузка лицензий
        onValue(licensesRef, (licSnapshot) => {
          const licData = licSnapshot.val();
          if (licData) {
            const licenses = Object.values(licData) as BotLicense[];
            newStats.totalLicenses = licenses.length;
            newStats.activeLicenses = licenses.filter(l => l.expires_at > now).length;
            newStats.expiredLicenses = licenses.filter(l => l.expires_at <= now).length;
            
            // Добавляем истекающие лицензии (v1.4.0 - поддержка нескольких ботов)
            const expiringLicenses: ExpiringItem[] = licenses
              .filter(l => {
                const daysRemaining = Math.ceil((l.expires_at - now) / (1000 * 60 * 60 * 24));
                return daysRemaining <= 7 && daysRemaining > 0;
              })
              .flatMap(l => {
                // Для лицензий с несколькими ботами создаём entry для каждого бота
                const botIds = l.bot_ids || [];
                if (botIds.length === 0) {
                  return [{
                    id: l.id,
                    type: 'license' as const,
                    name: `License (${l.type})`,
                    expiresAt: l.expires_at,
                    daysRemaining: Math.ceil((l.expires_at - now) / (1000 * 60 * 60 * 24)),
                  }];
                }
                return botIds.map(botId => {
                  const bot = data[botId];
                  return {
                    id: `${l.id}_${botId}`,
                    type: 'license' as const,
                    name: `License (${l.type})`,
                    botId: botId,
                    botName: bot?.character?.name,
                    expiresAt: l.expires_at,
                    daysRemaining: Math.ceil((l.expires_at - now) / (1000 * 60 * 60 * 24)),
                  };
                });
              });
            
            setExpiringItems(prev => [...prev.filter(i => i.type !== 'license'), ...expiringLicenses]);
          }
        }, { onlyOnce: true });

        // Загрузка прокси
        onValue(proxiesRef, (proxySnapshot) => {
          const proxyData = proxySnapshot.val();
          if (proxyData) {
            const proxies = Object.values(proxyData) as Proxy[];
            newStats.totalProxies = proxies.length;
            newStats.activeProxies = proxies.filter(p => p.expires_at > now && p.status !== 'banned').length;
            newStats.expiredProxies = proxies.filter(p => p.expires_at <= now || p.status === 'banned').length;
            
            // Добавляем истекающие прокси
            const expiringProxies = proxies
              .filter(p => {
                const daysRemaining = Math.ceil((p.expires_at - now) / (1000 * 60 * 60 * 24));
                return daysRemaining <= 7 && daysRemaining > 0;
              })
              .map(p => {
                const bot = p.bot_id ? data[p.bot_id] : null;
                return {
                  id: p.id,
                  type: 'proxy' as const,
                  name: `Proxy (${p.ip}:${p.port})`,
                  botId: p.bot_id || undefined,
                  botName: bot?.character?.name,
                  expiresAt: p.expires_at,
                  daysRemaining: Math.ceil((p.expires_at - now) / (1000 * 60 * 60 * 24)),
                };
              });
            
            setExpiringItems(prev => [...prev.filter(i => i.type !== 'proxy'), ...expiringProxies]);
          }
        }, { onlyOnce: true });

        // Загрузка подписок
        onValue(subscriptionsRef, (subSnapshot) => {
          const subData = subSnapshot.val();
          if (subData) {
            const subscriptions = Object.values(subData) as Subscription[];
            newStats.totalSubscriptions = subscriptions.length;
            newStats.activeSubscriptions = subscriptions.filter(s => s.expires_at > now).length;
            newStats.expiredSubscriptions = subscriptions.filter(s => s.expires_at <= now).length;
            
            // Добавляем истекающие подписки
            const expiringSubs = subscriptions
              .filter(s => {
                const daysRemaining = Math.ceil((s.expires_at - now) / (1000 * 60 * 60 * 24));
                return daysRemaining <= 7 && daysRemaining > 0;
              })
              .map(s => {
                const bot = s.bot_id ? data[s.bot_id] : null;
                return {
                  id: s.id,
                  type: 'subscription' as const,
                  name: `Subscription (${s.type})`,
                  botId: s.bot_id || undefined,
                  botName: bot?.character?.name,
                  expiresAt: s.expires_at,
                  daysRemaining: Math.ceil((s.expires_at - now) / (1000 * 60 * 60 * 24)),
                };
              });
            
            setExpiringItems(prev => [...prev.filter(i => i.type !== 'subscription'), ...expiringSubs]);
          }
          
          newStats.expiringSoonCount = 
            newStats.totalLicenses + newStats.totalProxies + newStats.totalSubscriptions;
          
          setStats(newStats);
          setLoading(false);
        }, { onlyOnce: true });

        // Генерация активности
        const activity = botsList
          .filter(b => b.last_seen > now - 24 * 60 * 60 * 1000)
          .slice(0, 5)
          .map(b => ({
            id: b.id,
            time: dayjs(b.last_seen).format('HH:mm'),
            bot: b.character.name,
            action: b.status === 'farming' ? 'Farming' : b.status === 'leveling' ? 'Leveling' : 'Active',
            project: b.project_id,
            status: b.status === 'banned' ? 'error' : 'success',
          }));
        setRecentActivity(activity);
      } else {
        setStats({
          totalBots: 0,
          activeBots: 0,
          offlineBots: 0,
          bannedBots: 0,
          totalLicenses: 0,
          activeLicenses: 0,
          expiredLicenses: 0,
          totalProxies: 0,
          activeProxies: 0,
          expiredProxies: 0,
          totalSubscriptions: 0,
          activeSubscriptions: 0,
          expiredSubscriptions: 0,
          expiringSoonCount: 0,
        });
        setLoading(false);
      }
    }, (error) => {
      console.error('Error loading dashboard data:', error);
      setLoading(false);
    });

    return () => {
      unsubscribeBots();
    };
  }, []);

  // Сортировка истекающих элементов
  const sortedExpiringItems = [...expiringItems].sort((a, b) => a.daysRemaining - b.daysRemaining);

  const projectColumns = [
    {
      title: 'Project',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: { game: string }) => (
        <div>
          <Text strong>{text}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: '11px' }}>{record.game}</Text>
        </div>
      ),
    },
    {
      title: 'Bots',
      dataIndex: 'bots',
      key: 'bots',
      width: 80,
      render: (bots: number, record: { active: number }) => (
        <Text>{record.active} / {bots}</Text>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag
          icon={status === 'online' ? <CheckCircleOutlined /> : <WarningOutlined />}
          color={status === 'online' ? 'success' : 'error'}
          style={{ margin: 0 }}
        >
          {status === 'online' ? 'Online' : 'Offline'}
        </Tag>
      ),
    },
    {
      title: 'Utilization',
      key: 'utilization',
      width: 150,
      render: (_: unknown, record: { active: number; bots: number }) => (
        <Progress
          percent={Math.round((record.active / record.bots) * 100)}
          size="small"
          strokeColor="var(--proxmox-accent)"
          trailColor="var(--proxmox-bg-tertiary)"
        />
      ),
    },
  ];

  const activityColumns = [
    {
      title: 'Time',
      dataIndex: 'time',
      key: 'time',
      width: 70,
    },
    {
      title: 'Bot',
      dataIndex: 'bot',
      key: 'bot',
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
    },
    {
      title: 'Project',
      dataIndex: 'project',
      key: 'project',
      width: 100,
      render: (project: string) => (
        <Tag style={{ margin: 0 }}>{project}</Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: string) => (
        <Tag
          color={status === 'success' ? 'success' : status === 'warning' ? 'warning' : 'error'}
          style={{ margin: 0 }}
        >
          {status === 'success' ? 'OK' : status === 'warning' ? 'Warn' : 'Error'}
        </Tag>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="datacenter-page">
        <ContentPanel type="datacenter">
          <div className="loading-container">
            <Spin size="large" />
          </div>
        </ContentPanel>
      </div>
    );
  }

  return (
    <div className="datacenter-page">
      <ContentPanel type="datacenter">
        {/* Expiring Soon Alert */}
        {sortedExpiringItems.length > 0 && (
          <Alert
            className="expiring-alert"
            message={
              <span>
                <WarningOutlined /> {sortedExpiringItems.length} item(s) expiring soon
              </span>
            }
            description={
              <List
                size="small"
                dataSource={sortedExpiringItems.slice(0, 5)}
                renderItem={item => (
                  <List.Item className="expiring-item">
                    <span>
                      <Tag color={
                        item.type === 'license' ? 'blue' : 
                        item.type === 'proxy' ? 'cyan' : 'purple'
                      }>
                        {item.type}
                      </Tag>
                      {item.name}
                      {item.botName && <Text type="secondary"> ({item.botName})</Text>}
                    </span>
                    <Tag color={item.daysRemaining <= 3 ? 'error' : 'warning'}>
                      {item.daysRemaining} days
                    </Tag>
                  </List.Item>
                )}
              />
            }
            type="warning"
            showIcon={false}
          />
        )}

        {/* Metrics Grid */}
        <Row gutter={[16, 16]} className="metrics-row">
          <Col span={6}>
            <MetricCard
              label="Total Bots"
              value={stats?.totalBots || 0}
              icon={<DesktopOutlined />}
              color="var(--proxmox-accent)"
            />
          </Col>
          <Col span={6}>
            <MetricCard
              label="Active Bots"
              value={stats?.activeBots || 0}
              icon={<CheckCircleOutlined />}
              color="#52c41a"
            />
          </Col>
          <Col span={6}>
            <MetricCard
              label="Offline Bots"
              value={stats?.offlineBots || 0}
              icon={<WarningOutlined />}
              color="#faad14"
            />
          </Col>
          <Col span={6}>
            <MetricCard
              label="Banned Bots"
              value={stats?.bannedBots || 0}
              icon={<DatabaseOutlined />}
              color="#ff4d4f"
            />
          </Col>
        </Row>

        {/* Licenses, Proxies, Subscriptions Stats */}
        <Row gutter={[16, 16]} className="metrics-row">
          <Col span={8}>
            <Card className="resource-card">
              <Statistic
                title={<span><KeyOutlined /> Licenses</span>}
                value={stats?.totalLicenses || 0}
                suffix={
                  <span className="stat-suffix">
                    <Tag color="success">{stats?.activeLicenses || 0} active</Tag>
                    {stats?.expiredLicenses ? <Tag color="error">{stats.expiredLicenses} expired</Tag> : null}
                  </span>
                }
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card className="resource-card">
              <Statistic
                title={<span><GlobalOutlined /> Proxies</span>}
                value={stats?.totalProxies || 0}
                suffix={
                  <span className="stat-suffix">
                    <Tag color="success">{stats?.activeProxies || 0} active</Tag>
                    {stats?.expiredProxies ? <Tag color="error">{stats.expiredProxies} expired</Tag> : null}
                  </span>
                }
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card className="resource-card">
              <Statistic
                title={<span><CreditCardOutlined /> Subscriptions</span>}
                value={stats?.totalSubscriptions || 0}
                suffix={
                  <span className="stat-suffix">
                    <Tag color="success">{stats?.activeSubscriptions || 0} active</Tag>
                    {stats?.expiredSubscriptions ? <Tag color="error">{stats.expiredSubscriptions} expired</Tag> : null}
                  </span>
                }
              />
            </Card>
          </Col>
        </Row>

        {/* Tables */}
        <Row gutter={[16, 16]} className="tables-row">
          <Col span={12}>
            <Card 
              title={
                <span>
                  <ClockCircleOutlined /> Recent Activity
                </span>
              }
              className="activity-card"
            >
              <Table
                dataSource={recentActivity}
                columns={activityColumns}
                pagination={false}
                size="small"
                rowKey="id"
              />
            </Card>
          </Col>
          <Col span={12}>
            <Card 
              title={
                <span>
                  <WarningOutlined /> Expiring Soon ({sortedExpiringItems.length})
                </span>
              }
              className="expiring-card"
            >
              {sortedExpiringItems.length > 0 ? (
                <List
                  size="small"
                  dataSource={sortedExpiringItems}
                  renderItem={item => (
                    <List.Item className="expiring-list-item">
                      <div className="expiring-info">
                        <Tag color={
                          item.type === 'license' ? 'blue' : 
                          item.type === 'proxy' ? 'cyan' : 'purple'
                        }>
                          {item.type}
                        </Tag>
                        <Text>{item.name}</Text>
                        {item.botName && (
                          <Text type="secondary" style={{ fontSize: '11px' }}>
                            {item.botName}
                          </Text>
                        )}
                      </div>
                      <div className="expiring-meta">
                        <Text type="secondary" style={{ fontSize: '11px' }}>
                          {dayjs(item.expiresAt).format('MMM DD')}
                        </Text>
                        <Tag color={item.daysRemaining <= 3 ? 'error' : 'warning'} style={{ marginLeft: 8 }}>
                          {item.daysRemaining}d
                        </Tag>
                      </div>
                    </List.Item>
                  )}
                />
              ) : (
                <div className="no-expiring">
                  <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 24 }} />
                  <Text type="secondary">No items expiring soon</Text>
                </div>
              )}
            </Card>
          </Col>
        </Row>
      </ContentPanel>
    </div>
  );
};
