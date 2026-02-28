import { Button, Select, Tag, Typography } from 'antd';
import type React from 'react';

interface VmTargetOption {
  id: string;
  label: string;
  isActive?: boolean;
}

interface VmTargetStripProps {
  targets: VmTargetOption[];
  selectedTargetId?: string;
  loading: boolean;
  sshConfigured: boolean;
  sshConnected: boolean;
  sshStatusCode?: string | number | null;
  onChange: (value?: string) => void;
  onRefresh: () => void;
}

export const VmTargetStrip: React.FC<VmTargetStripProps> = ({
  targets,
  selectedTargetId,
  loading,
  sshConfigured,
  sshConnected,
  sshStatusCode,
  onChange,
  onRefresh,
}) => {
  return (
    <div className="vm-generator-target-strip">
      <Typography.Text
        type="secondary"
        style={{
          margin: 0,
          color: 'var(--vmx-text-muted)',
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        Computer
      </Typography.Text>
      <Select
        allowClear
        size="small"
        placeholder="Auto (active computer)"
        value={selectedTargetId}
        options={targets.map((target) => ({
          value: target.id,
          label: `${target.label}${target.isActive ? ' (active)' : ''}`,
        }))}
        loading={loading}
        onChange={(value) => onChange(value)}
        style={{ minWidth: 320, maxWidth: 520 }}
      />
      <Button size="small" onClick={onRefresh} loading={loading}>
        Refresh Computers
      </Button>
      {!sshConfigured && (
        <Tag color="warning">SSH not configured: SSH-only features are disabled</Tag>
      )}
      {sshConfigured && !sshConnected && (
        <Tag color="error">
          SSH unavailable{sshStatusCode ? ` (${sshStatusCode})` : ''}: SSH-only features are
          disabled
        </Tag>
      )}
    </div>
  );
};
