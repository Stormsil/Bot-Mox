import React from 'react';
import { Spin, Card, Skeleton } from 'antd';
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
        {Array.from({ length: count }).map((_, index) => (
          <Card key={index} className={styles.loadingCard}>
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
    {Array.from({ length: count }).map((_, index) => (
      <div key={index} className={styles.listLoadingItem}>
        <Skeleton active avatar paragraph={{ rows: 1 }} />
      </div>
    ))}
  </div>
);
