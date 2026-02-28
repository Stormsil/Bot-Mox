import {
  EditOutlined,
  PlayCircleOutlined,
  PoweroffOutlined,
  RedoOutlined,
} from '@ant-design/icons';
import { Tag, Typography } from 'antd';
import type React from 'react';
import type { ProxmoxVM } from '../../shared/types';
import { TableActionButton, TableActionGroup } from '../../shared/ui/TableActionButton';

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

interface BuildVmListColumnsArgs {
  onStart: (vmid: number) => void;
  onStop: (vmid: number) => void;
  onRename: (vm: ProxmoxVM) => void;
  onRecreate?: (vm: ProxmoxVM) => void;
}

export function buildVmListColumns({
  onStart,
  onStop,
  onRename,
  onRecreate,
}: BuildVmListColumnsArgs) {
  return [
    {
      title: headerTitle('VMID'),
      dataIndex: 'vmid',
      key: 'vmid',
      width: 80,
      render: (vmid: number) => <Typography.Text code>{vmid}</Typography.Text>,
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
        return (
          <Tag bordered={false} color={colorMap[status] || 'default'}>
            {status.toUpperCase()}
          </Tag>
        );
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
              onClick={() => onStart(record.vmid)}
              tooltip="Start"
            />
          ) : (
            <TableActionButton
              danger
              icon={<PoweroffOutlined />}
              onClick={() => onStop(record.vmid)}
              tooltip="Stop"
            />
          )}
          <TableActionButton
            icon={<EditOutlined />}
            onClick={() => onRename(record)}
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
}
