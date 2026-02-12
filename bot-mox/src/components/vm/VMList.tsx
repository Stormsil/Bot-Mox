import React, { useEffect, useState } from 'react';
import { Table, Button, Tag, message } from 'antd';
import {
  PlayCircleOutlined,
  PoweroffOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import type { ProxmoxVM } from '../../types';
import { startVM, stopVM } from '../../services/vmService';
import { useProxmox } from '../../hooks/useProxmox';
import { TableActionButton, TableActionGroup } from '../ui/TableActionButton';
import './VMList.css';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

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

export const VMList: React.FC = () => {
  const { vms, loading, connected, node, refreshVMs } = useProxmox();
  const [tableHeight, setTableHeight] = useState(() => (
    typeof window === 'undefined' ? 520 : Math.max(260, window.innerHeight - 300)
  ));

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
      await startVM(vmid, node);
      message.success(`VM ${vmid} start requested`);
      setTimeout(refreshVMs, 2000);
    } catch (err) {
      message.error(`Failed to start VM ${vmid}: ${(err as Error).message}`);
    }
  };

  const handleStop = async (vmid: number) => {
    try {
      await stopVM(vmid, node);
      message.success(`VM ${vmid} stop requested`);
      setTimeout(refreshVMs, 2000);
    } catch (err) {
      message.error(`Failed to stop VM ${vmid}: ${(err as Error).message}`);
    }
  };

  const runningCount = vms.filter(vm => vm.status === 'running').length;
  const stoppedCount = vms.filter(vm => vm.status === 'stopped').length;

  const columns = [
    {
      title: 'VMID',
      dataIndex: 'vmid',
      key: 'vmid',
      width: 70,
      sorter: (a: ProxmoxVM, b: ProxmoxVM) => a.vmid - b.vmid,
      defaultSortOrder: 'ascend' as const,
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: 150,
      sorter: (a: ProxmoxVM, b: ProxmoxVM) => (a.name || '').localeCompare(b.name || ''),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
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
      title: 'CPU',
      dataIndex: 'cpu',
      key: 'cpu',
      width: 70,
      render: (val: number) => val ? `${(val * 100).toFixed(0)}%` : '-',
    },
    {
      title: 'Memory',
      dataIndex: 'mem',
      key: 'mem',
      width: 120,
      render: (_: number, record: ProxmoxVM) => {
        if (!record.maxmem) return '-';
        return `${formatBytes(record.mem)} / ${formatBytes(record.maxmem)}`;
      },
    },
    {
      title: 'Uptime',
      dataIndex: 'uptime',
      key: 'uptime',
      width: 100,
      render: (val: number) => formatUptime(val),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
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
        </TableActionGroup>
      ),
    },
  ];

  return (
    <div className="vm-list">
      <div className="vm-list-header">
        <div className="vm-list-stats">
          <span className="stat-item">
            <span className="stat-dot running" />
            {runningCount} running
          </span>
          <span className="stat-item">
            <span className="stat-dot stopped" />
            {stoppedCount} stopped
          </span>
          <span>Total: {vms.length}</span>
          {!connected && (
            <Tag color="error">Disconnected</Tag>
          )}
        </div>
        <Button
          size="small"
          icon={<ReloadOutlined />}
          onClick={refreshVMs}
          loading={loading}
        >
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
      />
    </div>
  );
};
