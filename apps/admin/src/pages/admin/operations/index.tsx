import { useGetIdentity } from '@refinedev/core';
import { Alert, Button, Card, Input, InputNumber, message, Space, Table, Typography } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiPost, apiRequest } from '../../../services/apiClient';
import styles from './AdminOperationsPage.module.css';

interface TenantAccessRow {
  tenant_id: string;
}

interface RuntimeMetricsSnapshot {
  ts: string;
  uptime_ms: number;
  active: {
    sse: number;
    ws: number;
  };
  counters: Record<string, number>;
}

interface RotateTenantsSummary {
  key_id: string;
  requested_tenants: number;
  successful_tenants: number;
  failed_tenants: number;
  rotated_total: number;
  skipped_total: number;
  failed_total: number;
}

interface IdentityShape {
  roles?: string[];
  access?: {
    access_tier?: 'free' | 'trial' | 'premium' | 'admin';
  };
}

function formatDate(value: string | null | undefined): string {
  const raw = String(value || '').trim();
  if (!raw) return '-';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString();
}

export const AdminOperationsPage: React.FC = () => {
  const { data: identity } = useGetIdentity<IdentityShape>();
  const [rows, setRows] = useState<TenantAccessRow[]>([]);
  const [rotationKeyId, setRotationKeyId] = useState('kms-2026q1');
  const [rotationReason, setRotationReason] = useState('manual_admin_rotation');
  const [rotationPerTenantLimit, setRotationPerTenantLimit] = useState<number>(1000);
  const [rotationLoading, setRotationLoading] = useState(false);
  const [rotationSummary, setRotationSummary] = useState<RotateTenantsSummary | null>(null);
  const [runtimeMetrics, setRuntimeMetrics] = useState<RuntimeMetricsSnapshot | null>(null);
  const [runtimeMetricsLoading, setRuntimeMetricsLoading] = useState(false);

  const isAdmin = useMemo(() => {
    const roles = Array.isArray(identity?.roles) ? identity.roles : [];
    const normalized = roles.map((role) =>
      String(role || '')
        .trim()
        .toLowerCase(),
    );
    return (
      normalized.includes('admin') ||
      normalized.includes('owner') ||
      identity?.access?.access_tier === 'admin'
    );
  }, [identity?.roles, identity?.access?.access_tier]);

  const loadTenants = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const response = await apiRequest<TenantAccessRow[]>(
        '/api/v1/admin/access/tenants?limit=1000',
        {
          method: 'GET',
        },
      );
      setRows(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to load tenants';
      message.error(text);
    }
  }, [isAdmin]);

  const loadRuntimeMetrics = useCallback(async () => {
    if (!isAdmin) return;
    setRuntimeMetricsLoading(true);
    try {
      const response = await apiRequest<RuntimeMetricsSnapshot>('/api/v1/diag/runtime-metrics', {
        method: 'GET',
      });
      const payload = response.data;
      if (payload && typeof payload === 'object') {
        setRuntimeMetrics(payload);
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to load runtime metrics';
      message.error(text);
    } finally {
      setRuntimeMetricsLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void loadTenants();
  }, [loadTenants]);

  useEffect(() => {
    void loadRuntimeMetrics();
  }, [loadRuntimeMetrics]);

  const rotateTenantSecrets = useCallback(async () => {
    const keyId = rotationKeyId.trim();
    if (!keyId) {
      message.error('key_id is required');
      return;
    }
    const tenantIds = Array.from(
      new Set(
        rows
          .map((row) =>
            String(row.tenant_id || '')
              .trim()
              .toLowerCase(),
          )
          .filter(Boolean),
      ),
    );
    if (tenantIds.length === 0) {
      message.warning('No tenants found to rotate');
      return;
    }

    setRotationLoading(true);
    try {
      const response = await apiPost<RotateTenantsSummary>('/api/v1/admin/secrets/rotate-tenants', {
        tenant_ids: tenantIds,
        key_id: keyId,
        limit_per_tenant: Math.max(1, Math.trunc(rotationPerTenantLimit)),
        ...(rotationReason.trim() ? { reason: rotationReason.trim() } : {}),
      });
      setRotationSummary(response.data);
      message.success(
        `Rotation completed: tenants ${response.data.successful_tenants}/${response.data.requested_tenants}, rotated ${response.data.rotated_total}`,
      );
      await loadRuntimeMetrics();
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to rotate tenant secrets';
      message.error(text);
    } finally {
      setRotationLoading(false);
    }
  }, [loadRuntimeMetrics, rotationKeyId, rotationPerTenantLimit, rotationReason, rows]);

  if (!isAdmin) {
    return (
      <div className={styles.root}>
        <Alert type="error" showIcon message="Admin role is required." />
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <Card className={styles.card} title="Admin Operations">
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Typography.Text type="secondary">
            Runtime counters and tenant-wide secrets rotation. Use after rollout or incident
            response.
          </Typography.Text>
          <div className={styles.formGrid}>
            <Input
              placeholder="key_id (e.g. kms-2026q1)"
              value={rotationKeyId}
              onChange={(event) => setRotationKeyId(event.target.value)}
            />
            <InputNumber
              min={1}
              max={10000}
              value={rotationPerTenantLimit}
              onChange={(value) =>
                setRotationPerTenantLimit(typeof value === 'number' ? value : 1000)
              }
              style={{ width: '100%' }}
            />
            <Input
              placeholder="reason (audit)"
              value={rotationReason}
              onChange={(event) => setRotationReason(event.target.value)}
            />
          </div>
          <Space wrap>
            <Button
              type="primary"
              loading={rotationLoading}
              onClick={() => void rotateTenantSecrets()}
            >
              Rotate Secrets For All Tenants
            </Button>
            <Button loading={runtimeMetricsLoading} onClick={() => void loadRuntimeMetrics()}>
              Refresh Runtime Metrics
            </Button>
            <Button onClick={() => void loadTenants()}>Refresh Tenants</Button>
          </Space>
          {rotationSummary ? (
            <Alert
              type={
                rotationSummary.failed_tenants > 0 || rotationSummary.failed_total > 0
                  ? 'warning'
                  : 'success'
              }
              showIcon
              message="Last rotation summary"
              description={`key_id=${rotationSummary.key_id}; tenants ${rotationSummary.successful_tenants}/${rotationSummary.requested_tenants}; rotated=${rotationSummary.rotated_total}; skipped=${rotationSummary.skipped_total}; failed=${rotationSummary.failed_total}`}
            />
          ) : null}
          {runtimeMetrics ? (
            <Card size="small" title="Runtime Metrics Snapshot">
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <Typography.Text>
                  Timestamp: {formatDate(runtimeMetrics.ts)} | Uptime:{' '}
                  {Math.round(runtimeMetrics.uptime_ms / 1000)}s | Active SSE:{' '}
                  {runtimeMetrics.active.sse} | Active WS: {runtimeMetrics.active.ws}
                </Typography.Text>
                <Table<{ metric: string; value: number }>
                  size="small"
                  rowKey="metric"
                  pagination={{ pageSize: 8 }}
                  dataSource={Object.entries(runtimeMetrics.counters || {})
                    .map(([metric, value]) => ({ metric, value: Number(value || 0) }))
                    .sort((a, b) => a.metric.localeCompare(b.metric))}
                  columns={[
                    { title: 'Metric', dataIndex: 'metric', key: 'metric', width: 360 },
                    { title: 'Value', dataIndex: 'value', key: 'value', width: 120 },
                  ]}
                />
              </Space>
            </Card>
          ) : null}
        </Space>
      </Card>
    </div>
  );
};
