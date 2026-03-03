import { ReloadOutlined } from '@ant-design/icons';

import React from 'react';
import type { ProxmoxVM } from '../../shared/types';
import { AppButton as Button, AppTable as Table, AppTag as Tag } from '../../shared/ui';
import styles from './VMList.module.css';
import { VmRenameModal } from './VmRenameModal';

export interface VMListViewProps {
  vms: ProxmoxVM[];
  loading: boolean;
  connected: boolean;
  refreshVMs: () => Promise<void> | void;
  tableHeight: number;
  runningCount: number;
  stoppedCount: number;
  columns: React.ComponentProps<typeof Table<ProxmoxVM>>['columns'];
  rename: {
    target: ProxmoxVM | null;
    value: string;
    saving: boolean;
    onValueChange: (value: string) => void;
    onCancel: () => void;
    onSubmit: () => Promise<void> | void;
  };
}

export const VMListView = React.memo(function VMListView({
  vms,
  loading,
  connected,
  refreshVMs,
  tableHeight,
  runningCount,
  stoppedCount,
  columns,
  rename,
}: VMListViewProps) {
  return (
    <div className={`${styles.root} vm-list`}>
      <div className={styles.header}>
        <div className={styles.stats}>
          <span className={styles.statItem}>
            <span className={`${styles.statDot} ${styles.statDotRunning}`} />
            {runningCount} running
          </span>
          <span className={styles.statItem}>
            <span className={`${styles.statDot} ${styles.statDotStopped}`} />
            {stoppedCount} stopped
          </span>
          <span>Total: {vms.length}</span>
          {!connected && <Tag intent="error">Disconnected</Tag>}
        </div>
        <Button size="small" icon={<ReloadOutlined />} onClick={refreshVMs} loading={loading}>
          Refresh
        </Button>
      </div>

      <Table
        dataSource={vms}
        columns={columns}
        rowKey="vmid"
        size="small"
        loading={loading}
        pagination={{ pageSize: 50, showSizeChanger: true, pageSizeOptions: ['25', '50', '100'] }}
        scroll={{ y: tableHeight }}
        className={styles.tableWrap}
      />

      <VmRenameModal
        target={rename.target}
        value={rename.value}
        onValueChange={rename.onValueChange}
        onCancel={rename.onCancel}
        onSubmit={rename.onSubmit}
        saving={rename.saving}
      />
    </div>
  );
});
