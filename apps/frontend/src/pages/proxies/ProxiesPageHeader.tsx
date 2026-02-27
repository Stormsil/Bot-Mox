import { DownOutlined, GlobalOutlined, PlusOutlined, RightOutlined } from '@ant-design/icons';
import { Button, Card, Typography } from 'antd';
import type React from 'react';
import styles from './ProxiesPage.module.css';

const { Title, Text } = Typography;

interface ProxiesPageHeaderProps {
  statsCollapsed: boolean;
  onToggleStats: () => void;
  onOpenCreate: () => void;
}

export const ProxiesPageHeader: React.FC<ProxiesPageHeaderProps> = ({
  statsCollapsed,
  onToggleStats,
  onOpenCreate,
}) => (
  <Card className={styles.header}>
    <div className={styles.headerContent}>
      <div className={styles.headerTitle}>
        <Title level={4} className={styles.pageTitle}>
          <GlobalOutlined /> Proxies
        </Title>
        <Text type="secondary" className={styles.headerSubtitle}>
          Manage proxy servers for bots
        </Text>
      </div>
      <div className={styles.headerActions}>
        <Button
          type="text"
          size="small"
          icon={statsCollapsed ? <RightOutlined /> : <DownOutlined />}
          onClick={onToggleStats}
        >
          Stats
        </Button>
        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={onOpenCreate}>
          Add Proxy
        </Button>
      </div>
    </div>
  </Card>
);
