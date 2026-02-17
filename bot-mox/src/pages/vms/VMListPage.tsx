import React from 'react';
import { VMList } from '../../components/vm';
import styles from './VMListPage.module.css';

export const VMListPage: React.FC = () => {
  return (
    <div className={styles.root}>
      <div className={styles.panel}>
        <div className={styles.header}>Proxmox VM List</div>
        <div className={styles.content}>
          <VMList />
        </div>
      </div>
    </div>
  );
};
