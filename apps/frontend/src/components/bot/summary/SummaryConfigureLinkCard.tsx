import { Card, Col } from 'antd';
import type React from 'react';
import styles from '../BotSummary.module.css';
import { detailCardStyles } from './summaryUi';

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
        <div className={styles['link-card-title']}>
          <span className={styles['link-card-icon']}>{icon}</span>
          <span>{title}</span>
        </div>
      }
      className={[styles['detail-card'], styles['link-card']].join(' ')}
      styles={detailCardStyles}
      hoverable
    >
      <div className={styles['link-card-header']}>
        {statusTag}
        <button type="button" className={styles['link-card-open-btn']} onClick={onOpen}>
          Open
        </button>
      </div>
      <div className={styles['summary-stats-list']}>{children}</div>
    </Card>
  </Col>
);
