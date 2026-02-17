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
        <GlobalOutlined />
        <span>Proxy Information</span>
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
