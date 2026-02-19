import {
  EditOutlined,
  PlayCircleOutlined,
  PoweroffOutlined,
  RedoOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { Button, Input, Modal, message, Table, Tag } from 'antd';
import type React from 'react';
import { useEffect, useState } from 'react';
import {
  useStartVmMutation,
  useStopVmMutation,
  useUpdateVmConfigMutation,
  useWaitForVmTaskMutation,
} from '../../entities/vm/api/useVmActionMutations';
import { useProxmox } from '../../hooks/useProxmox';
import type { ProxmoxVM } from '../../types';
import { TableActionButton, TableActionGroup } from '../ui/TableActionButton';
import styles from './VMList.module.css';

const headerTitle = (text: string) => (
  <span style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 11 }}>{text}</span>
);

function formatUptime(seconds: number): string {
  if (!seconds) return '-';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 24) {
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24}h`;
  }
  return `${h}h ${m}m`;
}

interface VMListViewProps {
  vms: ProxmoxVM[];
  loading: boolean;
  connected: boolean;
  node: string;
  refreshVMs: () => Promise<void> | void;
  onRecreate?: (vm: ProxmoxVM) => void;
}

export const VMList: React.FC = () => {
  const proxmox = useProxmox();
  return (
    <VMListView
      vms={proxmox.vms}
      loading={proxmox.loading}
      connected={proxmox.connected}
      node={proxmox.node}
      refreshVMs={proxmox.refreshVMs}
    />
  );
};

export const VMListView: React.FC<VMListViewProps> = ({
  vms,
  loading,
  connected,
  node,
  refreshVMs,
  onRecreate,
}) => {
  const startVmMutation = useStartVmMutation();
  const stopVmMutation = useStopVmMutation();
  const updateVmConfigMutation = useUpdateVmConfigMutation();
  const waitForVmTaskMutation = useWaitForVmTaskMutation();
  const [tableHeight, setTableHeight] = useState(() =>
    typeof window === 'undefined' ? 520 : Math.max(260, window.innerHeight - 300),
  );
  const [renameTarget, setRenameTarget] = useState<ProxmoxVM | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);

  useEffect(() => {
    const updateHeight = () => {
      setTableHeight(Math.max(260, window.innerHeight - 300));
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  const handleStart = async (vmid: number) => {
    try {
      await startVmMutation.mutateAsync({ vmid, node });
      message.success(`VM ${vmid} start requested`);
      void refreshVMs();
    } catch (err) {
      message.error(`Failed to start VM ${vmid}: ${(err as Error).message}`);
    }
  };

  const handleStop = async (vmid: number) => {
    try {
      await stopVmMutation.mutateAsync({ vmid, node });
      message.success(`VM ${vmid} stop requested`);
      void refreshVMs();
    } catch (err) {
      message.error(`Failed to stop VM ${vmid}: ${(err as Error).message}`);
    }
  };

  const openRenameModal = (vm: ProxmoxVM) => {
    setRenameTarget(vm);
    setRenameValue(String(vm.name || `VM ${vm.vmid}`));
  };

  const handleRenameSubmit = async () => {
    if (!renameTarget) {
      return;
    }

    const nextName = String(renameValue || '').trim();
    if (!nextName) {
      message.warning('VM name is required');
      return;
    }

    setRenameSaving(true);
    try {
      const result = await updateVmConfigMutation.mutateAsync({
        vmid: renameTarget.vmid,
        node,
        config: { name: nextName },
      });

      if (result.upid) {
        const status = await waitForVmTaskMutation.mutateAsync({
          upid: result.upid,
          node,
          options: { timeoutMs: 90_000, intervalMs: 1_000 },
        });
        if (status.exitstatus && status.exitstatus !== 'OK') {
          throw new Error(status.exitstatus);
        }
      }

      message.success(`VM ${renameTarget.vmid} renamed to ${nextName}`);
      setRenameTarget(null);
      setRenameValue('');
      void refreshVMs();
    } catch (err) {
      message.error(`Rename failed: ${(err as Error).message}`);
    } finally {
      setRenameSaving(false);
    }
  };

  const runningCount = vms.filter((vm) => vm.status === 'running').length;
  const stoppedCount = vms.filter((vm) => vm.status === 'stopped').length;

  const columns = [
    {
      title: headerTitle('VMID'),
      dataIndex: 'vmid',
      key: 'vmid',
      width: 80,
      sorter: (a: ProxmoxVM, b: ProxmoxVM) => a.vmid - b.vmid,
      defaultSortOrder: 'ascend' as const,
    },
    {
      title: headerTitle('Name'),
      dataIndex: 'name',
      key: 'name',
      sorter: (a: ProxmoxVM, b: ProxmoxVM) => (a.name || '').localeCompare(b.name || ''),
    },
    {
      title: headerTitle('Status'),
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          running: 'success',
          stopped: 'default',
          paused: 'warning',
        };
        return <Tag color={colorMap[status] || 'default'}>{status}</Tag>;
      },
      filters: [
        { text: 'Running', value: 'running' },
        { text: 'Stopped', value: 'stopped' },
      ],
      onFilter: (value: React.Key | boolean, record: ProxmoxVM) => record.status === value,
    },
    {
      title: headerTitle('Uptime'),
      dataIndex: 'uptime',
      key: 'uptime',
      width: 110,
      render: (val: number) => formatUptime(val),
    },
    {
      title: headerTitle('Actions'),
      key: 'actions',
      width: 150,
      render: (_: unknown, record: ProxmoxVM) => (
        <TableActionGroup>
          {record.status === 'stopped' ? (
            <TableActionButton
              icon={<PlayCircleOutlined style={{ color: '#52c41a' }} />}
              onClick={() => handleStart(record.vmid)}
              tooltip="Start"
            />
          ) : (
            <TableActionButton
              danger
              icon={<PoweroffOutlined />}
              onClick={() => handleStop(record.vmid)}
              tooltip="Stop"
            />
          )}

          <TableActionButton
            icon={<EditOutlined />}
            onClick={() => openRenameModal(record)}
            tooltip="Rename"
          />

          <TableActionButton
            icon={<RedoOutlined />}
            onClick={() => onRecreate?.(record)}
            tooltip="Recreate (delete + create in queue)"
            disabled={!onRecreate}
          />
        </TableActionGroup>
      ),
    },
  ];

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
          {!connected && <Tag color="error">Disconnected</Tag>}
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

      <Modal
        title={renameTarget ? `Rename VM ${renameTarget.vmid}` : 'Rename VM'}
        open={Boolean(renameTarget)}
        onCancel={() => {
          setRenameTarget(null);
          setRenameValue('');
        }}
        onOk={handleRenameSubmit}
        okText="Rename"
        confirmLoading={renameSaving}
        destroyOnHidden
      >
        <Input
          value={renameValue}
          onChange={(event) => setRenameValue(event.target.value)}
          maxLength={64}
          placeholder="Enter VM name"
          onPressEnter={() => {
            if (!renameSaving) {
              void handleRenameSubmit();
            }
          }}
        />
      </Modal>
    </div>
  );
};
