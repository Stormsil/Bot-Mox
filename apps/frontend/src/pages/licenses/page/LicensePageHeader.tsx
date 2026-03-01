import { DownOutlined, KeyOutlined, PlusOutlined, RightOutlined } from '@ant-design/icons';
import { Button, Card, Space, Typography } from 'antd';
import type React from 'react';
import styles from '../LicensesPage.module.css';

const { Title, Text } = Typography;

interface LicensePageHeaderProps {
  statsCollapsed: boolean;
  onToggleStats: () => void;
  onCreate: () => void;
}

export const LicensePageHeader: React.FC<LicensePageHeaderProps> = ({
  statsCollapsed,
  onToggleStats,
  onCreate,
}) => (
  <Card className={styles.header}>
    <div className={styles.headerContent}>
      <div className={styles.headerTitle}>
        <Title level={4} className={styles.headerHeading}>
          <KeyOutlined /> Bot Licenses
        </Title>
        <Text type="secondary" className={styles.headerSubtitle}>
          Manage bot software licenses
        </Text>
      </div>
      <Space>
        <Button
          type="text"
          icon={statsCollapsed ? <RightOutlined /> : <DownOutlined />}
          onClick={onToggleStats}
        >
          Stats
        </Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
          Add License
        </Button>
      </Space>
    </div>
  </Card>
);
