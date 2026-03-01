import { Col, Tag, Typography } from 'antd';
import type React from 'react';
import styles from '../BotSummary.module.css';

const { Text } = Typography;

export const ResourceStatusCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  statusTag: React.ReactNode;
  metaRows: Array<{ key: string; content: React.ReactNode }>;
  onClick: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
}> = ({ icon, title, statusTag, metaRows, onClick, onKeyDown }) => {
  return (
    <Col span={8}>
      <button
        type="button"
        className={[styles['status-item'], styles['status-item-button'], styles.clickable].join(
          ' ',
        )}
        onClick={onClick}
        onKeyDown={onKeyDown}
      >
        <span className={styles['status-icon']}>{icon}</span>
        <div>
          <Text type="secondary">{title}</Text>
          <br />
          {statusTag || <Tag>Not Assigned</Tag>}
          {metaRows.map((row) => (
            <div key={row.key} className={styles['status-meta']}>
              {row.content}
            </div>
          ))}
        </div>
      </button>
    </Col>
  );
};
