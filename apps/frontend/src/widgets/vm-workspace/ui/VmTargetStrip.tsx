import type React from 'react';
import {
  AppButton as Button,
  AppSelect as Select,
  AppTag as Tag,
  AppTypography as Typography,
} from '../../../shared/ui';
import { useVmTargetStripModel } from './useVmTargetStripModel';

interface VmTargetStripProps {
  sshConfigured: boolean;
  sshConnected: boolean;
  sshStatusCode?: string | number | null;
  onTargetChanged?: (options: { isCurrent: () => boolean }) => Promise<unknown> | unknown;
}

export const VmTargetStrip: React.FC<VmTargetStripProps> = ({
  sshConfigured,
  sshConnected,
  sshStatusCode,
  onTargetChanged,
}) => {
  const { targets, selectedTargetId, loading, handleTargetChange, handleRefresh } =
    useVmTargetStripModel({ onTargetChanged });

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
        onChange={(value) => handleTargetChange(value)}
        style={{ minWidth: 320, maxWidth: 520 }}
      />
      <Button size="small" onClick={handleRefresh} loading={loading}>
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
