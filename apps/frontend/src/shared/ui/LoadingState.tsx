import { Card, Skeleton, Spin } from 'antd';
import type React from 'react';
import styles from './LoadingState.module.css';

interface LoadingStateProps {
  type?: 'spinner' | 'skeleton' | 'card';
  count?: number;
  rows?: number;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  type = 'spinner',
  count = 1,
  rows = 4,
}) => {
  const cardSkeletonKeys = Array.from({ length: count }, (_unused, position) => `card-${position}`);

  if (type === 'spinner') {
    return (
      <div className={`${styles.loadingState} ${styles.spinner}`}>
        <Spin size="large" />
      </div>
    );
  }

  if (type === 'skeleton') {
    return (
      <div className={`${styles.loadingState} ${styles.skeleton}`}>
        <Skeleton active paragraph={{ rows }} />
      </div>
    );
  }

  if (type === 'card') {
    return (
      <div className={`${styles.loadingState} ${styles.card}`}>
        {cardSkeletonKeys.map((key) => (
          <Card key={key} className={styles.loadingCard}>
            <Skeleton active paragraph={{ rows }} />
          </Card>
        ))}
      </div>
    );
  }

  return null;
};

// Компонент для отображения состояния загрузки в таблице
export const TableLoadingState: React.FC = () => (
  <div className={styles.tableLoadingState}>
    <Skeleton active paragraph={{ rows: 6 }} />
  </div>
);

// Компонент для отображения состояния загрузки в списке
export const ListLoadingState: React.FC<{ count?: number }> = ({ count = 5 }) => (
  <div className={styles.listLoadingState}>
    {Array.from({ length: count }, (_unused, position) => `list-${position}`).map((key) => (
      <div key={key} className={styles.listLoadingItem}>
        <Skeleton active avatar paragraph={{ rows: 1 }} />
      </div>
    ))}
  </div>
);
