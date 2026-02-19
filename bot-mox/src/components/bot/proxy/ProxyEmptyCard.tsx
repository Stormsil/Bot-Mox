import { GlobalOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Card, Empty, Space, Typography } from 'antd';
import type React from 'react';
import styles from './proxy.module.css';

const { Text } = Typography;

interface ProxyEmptyCardProps {
  onAdd: () => void;
}

export const ProxyEmptyCard: React.FC<ProxyEmptyCardProps> = ({ onAdd }) => (
  <Card
    className={styles['proxy-card']}
    styles={{
      header: {
        background: 'var(--boxmox-color-surface-muted)',
        borderBottom: '1px solid var(--boxmox-color-border-default)',
      },
    }}
    title={
      <Space>
        <GlobalOutlined />
        <span className={styles['proxy-card-title']}>Proxy Information</span>
      </Space>
    }
    extra={
      <Button type="primary" size="small" icon={<PlusOutlined />} onClick={onAdd}>
        Add
      </Button>
    }
  >
    <Empty
      className={styles['proxy-empty']}
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={
        <span>
          <Text type="secondary">No proxy assigned to this bot</Text>
        </span>
      }
    />
  </Card>
);
