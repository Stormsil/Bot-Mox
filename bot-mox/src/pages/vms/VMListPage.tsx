import React from 'react';
import { VMList } from '../../components/vm';
import './VMListPage.css';

export const VMListPage: React.FC = () => {
  return (
    <div className="vm-list-page">
      <div className="vm-list-page-panel">
        <div className="vm-list-page-header">Proxmox VM List</div>
        <div className="vm-list-page-content">
          <VMList />
        </div>
      </div>
    </div>
  );
};
