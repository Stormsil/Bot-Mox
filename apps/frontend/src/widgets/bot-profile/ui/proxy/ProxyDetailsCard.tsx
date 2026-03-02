import { EditOutlined, GlobalOutlined, LinkOutlined } from '@ant-design/icons';
import { Button, Card, Col, Flex, Progress, Row, Space, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import type React from 'react';
import {
  getLocalFraudScoreColor,
  getLocalFraudScoreStatus,
  getProxyStatusColor,
  getProxyStatusIcon,
  getProxyStatusText,
} from './helpers';
import styles from './proxy.module.css';
import type { ProxyInfo } from './types';

const { Text } = Typography;

interface ProxyDetailsCardProps {
  proxy: ProxyInfo;
  onEdit: () => void;
  onUnassign: () => void;
}

export const ProxyDetailsCard: React.FC<ProxyDetailsCardProps> = ({
  proxy,
  onEdit,
  onUnassign,
}) => (
  <Card
    className={styles['proxy-card']}
    title={
      <Space>
        <GlobalOutlined className={styles['card-title-icon']} />
        <span className={styles['card-title']}>Proxy Information</span>
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
    <Flex vertical gap={16}>
      <Flex
        vertical
        gap={4}
        className={[styles['proxy-field'], styles['proxy-string-field']].join(' ')}
      >
        <Text type="secondary" className={styles['field-label']}>
          Proxy String
        </Text>
        <Flex align="center" gap={8}>
          <Text code className={styles['proxy-string']} copyable>
            {proxy.ip}:{proxy.port}:{proxy.login}:{proxy.password}
          </Text>
        </Flex>
      </Flex>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Flex vertical gap={4} className={styles['proxy-field']}>
            <Text type="secondary" className={styles['field-label']}>
              Type
            </Text>
            <div>
              <Tag
                bordered={false}
                color={proxy.type === 'socks5' ? 'blue' : 'cyan'}
                style={{ textTransform: 'uppercase' }}
              >
                {proxy.type.toUpperCase()}
              </Tag>
            </div>
          </Flex>
        </Col>

        <Col xs={24} md={12}>
          <Flex vertical gap={4} className={styles['proxy-field']}>
            <Text type="secondary" className={styles['field-label']}>
              Status
            </Text>
            <div>
              <Tag
                bordered={false}
                color={getProxyStatusColor(proxy)}
                icon={getProxyStatusIcon(proxy)}
              >
                {getProxyStatusText(proxy).toUpperCase()}
              </Tag>
            </div>
          </Flex>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Flex vertical gap={4} className={styles['proxy-field']}>
            <Text type="secondary" className={styles['field-label']}>
              Provider
            </Text>
            <div>
              <Text>{proxy.provider || 'Unknown'}</Text>
            </div>
          </Flex>
        </Col>

        <Col xs={24} md={12}>
          <Flex vertical gap={4} className={styles['proxy-field']}>
            <Text type="secondary" className={styles['field-label']}>
              Country
            </Text>
            <div>
              <Text>{proxy.country || 'Unknown'}</Text>
            </div>
          </Flex>
        </Col>
      </Row>

      <Flex vertical gap={4} className={styles['proxy-field']}>
        <Text type="secondary" className={styles['field-label']}>
          Fraud Score
        </Text>
        <Space size={8} align="center">
          <Progress
            percent={proxy.fraud_score}
            size="small"
            strokeColor={getLocalFraudScoreColor(proxy.fraud_score)}
            trailColor="var(--boxmox-color-surface-muted)"
            style={{ width: 200 }}
          />
          <Text style={{ color: getLocalFraudScoreColor(proxy.fraud_score) }}>
            {getLocalFraudScoreStatus(proxy.fraud_score)}
          </Text>
        </Space>
      </Flex>

      <Flex vertical gap={4} className={styles['proxy-field']}>
        <Text type="secondary" className={styles['field-label']}>
          Expiration Date
        </Text>
        <Space size={8} align="center">
          <Text
            strong
            style={{
              color: proxy.isExpired ? '#ff4d4f' : proxy.isExpiringSoon ? '#faad14' : undefined,
            }}
          >
            {dayjs(proxy.expires_at).format('DD.MM.YYYY HH:mm')}
          </Text>
          {proxy.daysRemaining !== undefined && (
            <Text type="secondary">
              ({proxy.isExpired ? 'Expired' : `${proxy.daysRemaining} days remaining`})
            </Text>
          )}
        </Space>
      </Flex>
    </Flex>
  </Card>
);
