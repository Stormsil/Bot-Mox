import React from 'react';
import { Button, Card, Empty, Space, Typography } from 'antd';
import { GlobalOutlined, PlusOutlined } from '@ant-design/icons';
import styles from './proxy.module.css';

const { Text } = Typography;

interface ProxyEmptyCardProps {
  onAdd: () => void;
}

export const ProxyEmptyCard: React.FC<ProxyEmptyCardProps> = ({ onAdd }) => (
  <Card
    className={styles['proxy-card']}
    title={
      <Space>
        <GlobalOutlined className={styles['card-title-icon']} />
        <span className={styles['card-title']}>Proxy Information</span>
      </Space>
    }
    styles={{
      header: {
        background: 'var(--boxmox-color-surface-muted)',
        borderBottom: '1px solid var(--boxmox-color-border-default)',
      },
    }}
    extra={
      <Button type="primary" size="small" icon={<PlusOutlined />} onClick={onAdd}>
        Add
      </Button>
    }
  >
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={
        <span className={styles['empty-description']}>
          <Text type="secondary">No proxy assigned to this bot</Text>
        </span>
      }
    />
  </Card>
);
