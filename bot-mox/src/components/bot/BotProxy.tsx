import React, { useState, useEffect } from 'react';
import { Card, Typography, Tag, Button, Space, Alert, Spin, Empty, message, Progress } from 'antd';
import { GlobalOutlined, CopyOutlined, WarningOutlined, CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined, LinkOutlined } from '@ant-design/icons';
import { ref, onValue } from 'firebase/database';
import { database } from '../../utils/firebase';
import type { Proxy } from '../../types';
import type { Bot } from '../../types';
import dayjs from 'dayjs';
import './BotProxy.css';

const { Title, Text } = Typography;

interface BotProxyProps {
  bot: Bot;
}

interface ProxyInfo extends Proxy {
  daysRemaining?: number;
  isExpired?: boolean;
  isExpiringSoon?: boolean;
}

export const BotProxy: React.FC<BotProxyProps> = ({ bot }) => {
  const [proxy, setProxy] = useState<ProxyInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Сначала проверяем прокси в данных бота
    const botRef = ref(database, `bots/${bot.id}/proxy`);
    const proxiesRef = ref(database, 'proxies');
    
    const unsubscribeBot = onValue(botRef, (snapshot) => {
      const botProxyData = snapshot.val();
      
      if (botProxyData && botProxyData.ip) {
        // Прокси есть в данных бота
        const daysRemaining = botProxyData.expires_at 
          ? Math.ceil((botProxyData.expires_at - Date.now()) / (1000 * 60 * 60 * 24))
          : undefined;
        
        setProxy({
          ...botProxyData,
          id: 'bot_proxy',
          daysRemaining,
          isExpired: botProxyData.expires_at ? Date.now() > botProxyData.expires_at : false,
          isExpiringSoon: daysRemaining !== undefined ? daysRemaining <= 7 && daysRemaining > 0 : false,
        });
        setLoading(false);
      } else {
        // Ищем в общем списке прокси
        const unsubscribeProxies = onValue(proxiesRef, (snapshot) => {
          const data = snapshot.val();
          if (data) {
            const foundProxy = Object.entries(data).find(([_, value]) => {
              const p = value as Proxy;
              return p.bot_id === bot.id;
            });

            if (foundProxy) {
              const [id, proxyData] = foundProxy;
              const p = proxyData as Proxy;
              const daysRemaining = Math.ceil((p.expires_at - Date.now()) / (1000 * 60 * 60 * 24));
              
              setProxy({
                ...p,
                id,
                daysRemaining,
                isExpired: Date.now() > p.expires_at,
                isExpiringSoon: daysRemaining <= 7 && daysRemaining > 0,
              });
            } else {
              setProxy(null);
            }
          } else {
            setProxy(null);
          }
          setLoading(false);
        }, (error) => {
          console.error('Error loading proxy:', error);
          message.error('Failed to load proxy data');
          setLoading(false);
        });

        return () => unsubscribeProxies();
      }
    }, (error) => {
      console.error('Error loading bot proxy:', error);
      setLoading(false);
    });

    return () => unsubscribeBot();
  }, [bot.id]);

  const copyProxyString = () => {
    if (proxy) {
      const proxyString = `${proxy.ip}:${proxy.port}:${proxy.login}:${proxy.password}`;
      navigator.clipboard.writeText(proxyString);
      message.success('Proxy string copied');
    }
  };

  const getFraudScoreColor = (score: number) => {
    if (score <= 20) return '#52c41a';
    if (score <= 50) return '#faad14';
    return '#ff4d4f';
  };

  const getFraudScoreStatus = (score: number) => {
    if (score <= 20) return 'Low Risk';
    if (score <= 50) return 'Medium Risk';
    return 'High Risk';
  };

  if (loading) {
    return (
      <div className="bot-proxy">
        <Card className="proxy-card">
          <Spin size="large" />
        </Card>
      </div>
    );
  }

  if (!proxy) {
    return (
      <div className="bot-proxy">
        <Card className="proxy-card">
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span>
                <Text type="secondary">No proxy assigned to this bot</Text>
                <br />
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  Go to Proxies page to assign a proxy
                </Text>
              </span>
            }
          />
        </Card>
      </div>
    );
  }

  const getStatusIcon = () => {
    if (proxy.isExpired) return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />;
    if (proxy.isExpiringSoon) return <ClockCircleOutlined style={{ color: '#faad14' }} />;
    if (proxy.status === 'banned') return <WarningOutlined style={{ color: '#ff4d4f' }} />;
    return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
  };

  const getStatusColor = () => {
    if (proxy.isExpired) return 'error';
    if (proxy.isExpiringSoon) return 'warning';
    if (proxy.status === 'banned') return 'error';
    return 'success';
  };

  const getStatusText = () => {
    if (proxy.isExpired) return 'Expired';
    if (proxy.isExpiringSoon) return `Expiring in ${proxy.daysRemaining} days`;
    if (proxy.status === 'banned') return 'Banned';
    return 'Active';
  };

  return (
    <div className="bot-proxy">
      {/* Alert для истекающего/истекшего прокси */}
      {(proxy.isExpired || proxy.isExpiringSoon || proxy.status === 'banned') && (
        <Alert
          className="proxy-alert"
          message={
            proxy.isExpired ? 'Proxy Expired' : 
            proxy.status === 'banned' ? 'Proxy Banned' : 
            'Proxy Expiring Soon'
          }
          description={
            proxy.isExpired 
              ? 'This proxy has expired. The bot may lose connection. Please renew the proxy.'
              : proxy.status === 'banned'
              ? 'This proxy has been banned. The bot may not function properly. Please assign a new proxy.'
              : `This proxy will expire in ${proxy.daysRemaining} day(s). Please renew soon to avoid connection issues.`
          }
          type={proxy.isExpired || proxy.status === 'banned' ? 'error' : 'warning'}
          showIcon
          icon={<WarningOutlined />}
        />
      )}

      <Card className="proxy-card" title={
        <Space>
          <GlobalOutlined />
          <span>Proxy Information</span>
        </Space>
      }>
        <div className="proxy-content">
          <div className="proxy-field">
            <Text type="secondary" className="field-label">Address</Text>
            <div className="proxy-address-container">
              <Text strong className="proxy-address">
                {proxy.ip}:{proxy.port}
              </Text>
              <Button 
                type="text" 
                size="small" 
                icon={<CopyOutlined />}
                onClick={copyProxyString}
              >
                Copy
              </Button>
            </div>
          </div>

          <div className="proxy-row">
            <div className="proxy-field">
              <Text type="secondary" className="field-label">Type</Text>
              <div>
                <Tag color={proxy.type === 'socks5' ? 'blue' : 'cyan'} style={{ textTransform: 'uppercase' }}>
                  {proxy.type}
                </Tag>
              </div>
            </div>

            <div className="proxy-field">
              <Text type="secondary" className="field-label">Status</Text>
              <div>
                <Tag color={getStatusColor()} icon={getStatusIcon()}>
                  {getStatusText()}
                </Tag>
              </div>
            </div>
          </div>

          <div className="proxy-row">
            <div className="proxy-field">
              <Text type="secondary" className="field-label">Provider</Text>
              <div>
                <Text>{proxy.provider || 'Unknown'}</Text>
              </div>
            </div>

            <div className="proxy-field">
              <Text type="secondary" className="field-label">Country</Text>
              <div>
                <Text>{proxy.country || 'Unknown'}</Text>
              </div>
            </div>
          </div>

          <div className="proxy-field">
            <Text type="secondary" className="field-label">Fraud Score</Text>
            <div className="fraud-score-container">
              <Progress
                percent={proxy.fraud_score}
                size="small"
                strokeColor={getFraudScoreColor(proxy.fraud_score)}
                trailColor="var(--proxmox-bg-tertiary)"
                style={{ width: 200 }}
              />
              <Text style={{ color: getFraudScoreColor(proxy.fraud_score), marginLeft: 8 }}>
                {getFraudScoreStatus(proxy.fraud_score)}
              </Text>
            </div>
          </div>

          <div className="proxy-row">
            <div className="proxy-field">
              <Text type="secondary" className="field-label">Login</Text>
              <div>
                <Text className="credential-text">{proxy.login}</Text>
              </div>
            </div>

            <div className="proxy-field">
              <Text type="secondary" className="field-label">Password</Text>
              <div>
                <Text className="credential-text" copyable>
                  {proxy.password}
                </Text>
              </div>
            </div>
          </div>

          <div className="proxy-row">
            <div className="proxy-field">
              <Text type="secondary" className="field-label">Created</Text>
              <div>
                <Text>{dayjs(proxy.created_at).format('DD.MM.YYYY HH:mm')}</Text>
              </div>
            </div>

            <div className="proxy-field">
              <Text type="secondary" className="field-label">Last Updated</Text>
              <div>
                <Text>{dayjs(proxy.updated_at).format('DD.MM.YYYY HH:mm')}</Text>
              </div>
            </div>
          </div>

          <div className="proxy-field">
            <Text type="secondary" className="field-label">Expiration Date</Text>
            <div className="expiration-info">
              <Text 
                strong 
                style={{ 
                  color: proxy.isExpired ? '#ff4d4f' : proxy.isExpiringSoon ? '#faad14' : undefined 
                }}
              >
                {dayjs(proxy.expires_at).format('DD.MM.YYYY HH:mm')}
              </Text>
              {proxy.daysRemaining !== undefined && (
                <Text type="secondary" style={{ marginLeft: 8 }}>
                  ({proxy.isExpired ? 'Expired' : `${proxy.daysRemaining} days remaining`})
                </Text>
              )}
            </div>
          </div>

          {(proxy.isExpired || proxy.status === 'banned') && (
            <div className="proxy-actions">
              <Alert
                message="Action Required"
                description="Please update the proxy to ensure bot connectivity."
                type="error"
                showIcon
              />
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
