import React from 'react';
import { Button, Card, Progress, Space, Tag, Typography } from 'antd';
import { EditOutlined, GlobalOutlined, LinkOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  getLocalFraudScoreColor,
  getLocalFraudScoreStatus,
  getProxyStatusColor,
  getProxyStatusIcon,
  getProxyStatusText,
} from './helpers';
import type { ProxyInfo } from './types';

const { Text } = Typography;

interface ProxyDetailsCardProps {
  proxy: ProxyInfo;
  onEdit: () => void;
  onUnassign: () => void;
}

export const ProxyDetailsCard: React.FC<ProxyDetailsCardProps> = ({ proxy, onEdit, onUnassign }) => (
  <Card
    className="proxy-card"
    title={
      <Space>
        <GlobalOutlined />
        <span>Proxy Information</span>
      </Space>
    }
    extra={
      <Space>
        <Button type="primary" icon={<EditOutlined />} size="small" onClick={onEdit}>
          Edit
        </Button>
        <Button danger icon={<LinkOutlined />} size="small" onClick={onUnassign}>
          Unassign
        </Button>
      </Space>
    }
  >
    <div className="proxy-content">
      <div className="proxy-field proxy-string-field">
        <Text type="secondary" className="field-label">
          Proxy String
        </Text>
        <div className="proxy-string-container">
          <Text strong className="proxy-string" copyable>
            {proxy.ip}:{proxy.port}:{proxy.login}:{proxy.password}
          </Text>
        </div>
      </div>

      <div className="proxy-row">
        <div className="proxy-field">
          <Text type="secondary" className="field-label">
            Type
          </Text>
          <div>
            <Tag color={proxy.type === 'socks5' ? 'blue' : 'cyan'} style={{ textTransform: 'uppercase' }}>
              {proxy.type}
            </Tag>
          </div>
        </div>

        <div className="proxy-field">
          <Text type="secondary" className="field-label">
            Status
          </Text>
          <div>
            <Tag color={getProxyStatusColor(proxy)} icon={getProxyStatusIcon(proxy)}>
              {getProxyStatusText(proxy)}
            </Tag>
          </div>
        </div>
      </div>

      <div className="proxy-row">
        <div className="proxy-field">
          <Text type="secondary" className="field-label">
            Provider
          </Text>
          <div>
            <Text>{proxy.provider || 'Unknown'}</Text>
          </div>
        </div>

        <div className="proxy-field">
          <Text type="secondary" className="field-label">
            Country
          </Text>
          <div>
            <Text>{proxy.country || 'Unknown'}</Text>
          </div>
        </div>
      </div>

      <div className="proxy-field">
        <Text type="secondary" className="field-label">
          Fraud Score
        </Text>
        <div className="fraud-score-container">
          <Progress
            percent={proxy.fraud_score}
            size="small"
            strokeColor={getLocalFraudScoreColor(proxy.fraud_score)}
            trailColor="var(--boxmox-color-surface-muted)"
            style={{ width: 200 }}
          />
          <Text style={{ color: getLocalFraudScoreColor(proxy.fraud_score), marginLeft: 8 }}>
            {getLocalFraudScoreStatus(proxy.fraud_score)}
          </Text>
        </div>
      </div>

      <div className="proxy-field">
        <Text type="secondary" className="field-label">
          Expiration Date
        </Text>
        <div className="expiration-info">
          <Text
            strong
            style={{
              color: proxy.isExpired ? '#ff4d4f' : proxy.isExpiringSoon ? '#faad14' : undefined,
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
    </div>
  </Card>
);
