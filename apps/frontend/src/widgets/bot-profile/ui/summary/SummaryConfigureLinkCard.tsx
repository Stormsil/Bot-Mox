import { Card, Col, Flex, Space } from 'antd';
import type React from 'react';
import styles from '../BotSummary.module.css';

interface SummaryConfigureLinkCardProps {
  icon: React.ReactNode;
  title: string;
  statusTag: React.ReactNode;
  onOpen: () => void;
  children: React.ReactNode;
}

export const SummaryConfigureLinkCard: React.FC<SummaryConfigureLinkCardProps> = ({
  icon,
  title,
  statusTag,
  onOpen,
  children,
}) => (
  <Col span={8}>
    <Card
      title={
        <Space className={styles['link-card-title']} size={8}>
          <span className={styles['link-card-icon']}>{icon}</span>
          <span>{title}</span>
        </Space>
      }
      className={[styles['detail-card'], styles['link-card']].join(' ')}
      hoverable
    >
      <Flex className={styles['link-card-header']} align="center" justify="space-between">
        {statusTag}
        <button type="button" className={styles['link-card-open-btn']} onClick={onOpen}>
          Open
        </button>
      </Flex>
      <Flex vertical className={styles['summary-stats-list']} gap={12}>
        {children}
      </Flex>
    </Card>
  </Col>
);
