import { GlobalOutlined, PlusOutlined } from '@ant-design/icons';

import type React from 'react';
import {
  AppButton as Button,
  AppCard as Card,
  AppEmpty as Empty,
  AppSpace as Space,
  AppTypography as Typography,
} from '../../../../shared/ui';
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
