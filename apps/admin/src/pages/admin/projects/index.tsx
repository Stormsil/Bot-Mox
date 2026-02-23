import { useGetIdentity } from '@refinedev/core';
import {
  Alert,
  Button,
  Card,
  Input,
  InputNumber,
  message,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { SortOrder } from 'antd/es/table/interface';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createAdminProjectRelease,
  listAdminProjectReleases,
  listAdminProjectRolloutStatus,
  rollbackAdminProjects,
  rolloutAdminProjects,
  stagedRolloutAdminProjects,
} from '../../../providers/admin-projects-contract-client';

interface IdentityShape {
  roles?: string[];
  access?: {
    access_tier?: 'free' | 'trial' | 'premium' | 'admin';
  };
}

interface ReleaseRow {
  id: string;
  project_key: string;
  version: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface RolloutStatusRow {
  id: string;
  tenant_id: string;
  project_key: string;
  release_id: string;
  status: string;
  wave: string | null;
  notes: string | null;
  rolled_out_at: string;
  updated_at: string;
  release: {
    project_key: string;
    version: string;
    status: string;
  };
}

interface PagedData<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  sort: string;
  order: 'asc' | 'desc';
}

function mapOrderToAntd(order: 'asc' | 'desc' | null | undefined): SortOrder {
  if (order === 'asc') return 'ascend';
  if (order === 'desc') return 'descend';
  return null;
}

function mapAntdToApiOrder(order: SortOrder | undefined): 'asc' | 'desc' {
  return order === 'ascend' ? 'asc' : 'desc';
}

function formatDate(value: string | null | undefined): string {
  const raw = String(value || '').trim();
  if (!raw) return '-';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString();
}

export const AdminProjectsPage: React.FC = () => {
  const { data: identity } = useGetIdentity<IdentityShape>();
  const [projectKey, setProjectKey] = useState('botmox-core');
  const [version, setVersion] = useState('');
  const [releaseStatus, setReleaseStatus] = useState('active');
  const [releaseRows, setReleaseRows] = useState<ReleaseRow[]>([]);
  const [statusRows, setStatusRows] = useState<RolloutStatusRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [rolloutProjectKey, setRolloutProjectKey] = useState('botmox-core');
  const [rolloutReleaseId, setRolloutReleaseId] = useState('');
  const [rolloutScope, setRolloutScope] = useState<'tenant' | 'wave' | 'all'>('tenant');
  const [rolloutTenantId, setRolloutTenantId] = useState('');
  const [rolloutTenantIdsText, setRolloutTenantIdsText] = useState('');
  const [rolloutBatchSize, setRolloutBatchSize] = useState<number>(20);
  const [rolloutWave, setRolloutWave] = useState('');
  const [rolloutNotes, setRolloutNotes] = useState('');
  const [statusFilterProject, setStatusFilterProject] = useState('');
  const [statusFilterTenant, setStatusFilterTenant] = useState('');
  const [statusFilterState, setStatusFilterState] = useState('');
  const [releaseFilterProject, setReleaseFilterProject] = useState('');
  const [releaseFilterStatus, setReleaseFilterStatus] = useState('');
  const [releasePage, setReleasePage] = useState(1);
  const [releasePageSize, setReleasePageSize] = useState(8);
  const [releaseTotal, setReleaseTotal] = useState(0);
  const [releaseSort, setReleaseSort] = useState<{
    field: 'updated_at' | 'created_at' | 'version' | 'project_key' | 'status';
    order: 'asc' | 'desc';
  }>({ field: 'updated_at', order: 'desc' });
  const [statusPage, setStatusPage] = useState(1);
  const [statusPageSize, setStatusPageSize] = useState(10);
  const [statusTotal, setStatusTotal] = useState(0);
  const [statusSort, setStatusSort] = useState<{
    field: 'updated_at' | 'rolled_out_at' | 'tenant_id' | 'project_key' | 'status' | 'wave';
    order: 'asc' | 'desc';
  }>({ field: 'updated_at', order: 'desc' });

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

  const loadStatus = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const response = await listAdminProjectRolloutStatus({
        page: statusPage,
        limit: statusPageSize,
        sort: statusSort.field,
        order: statusSort.order,
        ...(statusFilterProject.trim() ? { project_key: statusFilterProject.trim() } : {}),
        ...(statusFilterTenant.trim()
          ? { tenant_id: statusFilterTenant.trim().toLowerCase() }
          : {}),
        ...(statusFilterState.trim() ? { status: statusFilterState.trim() } : {}),
      });
      const payload = response.data as PagedData<RolloutStatusRow> | RolloutStatusRow[];
      const rows = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.items)
          ? payload.items
          : [];
      const total = Array.isArray(payload) ? rows.length : Number(payload?.total || rows.length);
      setStatusRows(rows);
      setStatusTotal(Number.isFinite(total) ? total : rows.length);
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to load rollout status';
      message.error(text);
    }
  }, [
    isAdmin,
    statusFilterProject,
    statusFilterState,
    statusFilterTenant,
    statusPage,
    statusPageSize,
    statusSort.field,
    statusSort.order,
  ]);

  const loadReleases = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const response = await listAdminProjectReleases({
        page: releasePage,
        limit: releasePageSize,
        sort: releaseSort.field,
        order: releaseSort.order,
        ...(releaseFilterProject.trim() ? { project_key: releaseFilterProject.trim() } : {}),
        ...(releaseFilterStatus.trim() ? { status: releaseFilterStatus.trim() } : {}),
      });
      const payload = response.data as PagedData<ReleaseRow> | ReleaseRow[];
      const rows = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.items)
          ? payload.items
          : [];
      const total = Array.isArray(payload) ? rows.length : Number(payload?.total || rows.length);
      setReleaseRows(rows);
      setReleaseTotal(Number.isFinite(total) ? total : rows.length);
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to load releases';
      message.error(text);
    }
  }, [
    isAdmin,
    releaseFilterProject,
    releaseFilterStatus,
    releasePage,
    releasePageSize,
    releaseSort.field,
    releaseSort.order,
  ]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    void loadReleases();
  }, [loadReleases]);

  const createRelease = useCallback(async () => {
    const normalizedProject = projectKey.trim();
    const normalizedVersion = version.trim();
    if (!normalizedProject || !normalizedVersion) {
      message.error('project_key and version are required');
      return;
    }
    setLoading(true);
    try {
      const response = await createAdminProjectRelease({
        project_key: normalizedProject,
        version: normalizedVersion,
        status: releaseStatus.trim() || 'active',
      });
      const created = response.data as ReleaseRow;
      setReleaseRows((prev) => [created, ...prev.filter((item) => item.id !== created.id)]);
      setRolloutReleaseId(created.id);
      setRolloutProjectKey(created.project_key);
      setVersion('');
      message.success(`Release created: ${created.project_key}@${created.version}`);
      await Promise.all([loadReleases(), loadStatus()]);
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to create release';
      message.error(text);
    } finally {
      setLoading(false);
    }
  }, [loadReleases, loadStatus, projectKey, releaseStatus, version]);

  const parseTenantIds = useCallback((raw: string): string[] => {
    const tokens = raw
      .split(/[\n,;\s]+/)
      .map((value) =>
        String(value || '')
          .trim()
          .toLowerCase(),
      )
      .filter(Boolean);
    return Array.from(new Set(tokens));
  }, []);

  const runRollout = useCallback(async () => {
    const normalizedProject = rolloutProjectKey.trim();
    const normalizedReleaseId = rolloutReleaseId.trim();
    const normalizedTenant = rolloutTenantId.trim().toLowerCase();
    const parsedTenantIds = parseTenantIds(rolloutTenantIdsText);
    if (!normalizedProject || !normalizedReleaseId) {
      message.error('project_key and release_id are required');
      return;
    }
    if (rolloutScope === 'tenant' && !normalizedTenant) {
      message.error('tenant_id is required for tenant scope');
      return;
    }
    if (rolloutScope === 'wave' && !rolloutWave.trim()) {
      message.error('wave is required for wave scope');
      return;
    }
    if (rolloutScope === 'wave' && parsedTenantIds.length === 0) {
      message.error('tenant_ids are required for wave scope');
      return;
    }

    setLoading(true);
    try {
      const response = await rolloutAdminProjects({
        project_key: normalizedProject,
        release_id: normalizedReleaseId,
        scope: rolloutScope,
        ...(rolloutScope === 'tenant' ? { tenant_id: normalizedTenant } : {}),
        ...(rolloutScope === 'wave' ? { tenant_ids: parsedTenantIds } : {}),
        ...(rolloutScope === 'all'
          ? { batch_size: Math.max(1, Math.trunc(rolloutBatchSize)) }
          : {}),
        ...(rolloutWave.trim() ? { wave: rolloutWave.trim() } : {}),
        ...(rolloutNotes.trim() ? { notes: rolloutNotes.trim() } : {}),
      });
      const data = (response.data as { count?: number }) || {};
      message.success(`Rollout completed. Updated tenants: ${data.count ?? 0}`);
      await Promise.all([loadStatus(), loadReleases()]);
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to rollout release';
      message.error(text);
    } finally {
      setLoading(false);
    }
  }, [
    loadReleases,
    loadStatus,
    parseTenantIds,
    rolloutBatchSize,
    rolloutNotes,
    rolloutProjectKey,
    rolloutReleaseId,
    rolloutScope,
    rolloutTenantId,
    rolloutTenantIdsText,
    rolloutWave,
  ]);

  const runRollback = useCallback(async () => {
    const normalizedProject = rolloutProjectKey.trim();
    const normalizedTenant = rolloutTenantId.trim().toLowerCase();
    const parsedTenantIds = parseTenantIds(rolloutTenantIdsText);
    if (!normalizedProject) {
      message.error('project_key is required');
      return;
    }
    if (rolloutScope === 'tenant' && !normalizedTenant) {
      message.error('tenant_id is required for tenant scope');
      return;
    }
    if (rolloutScope === 'wave' && !rolloutWave.trim()) {
      message.error('wave is required for wave scope');
      return;
    }
    if (rolloutScope === 'wave' && parsedTenantIds.length === 0) {
      message.error('tenant_ids are required for wave scope');
      return;
    }

    setLoading(true);
    try {
      const response = await rollbackAdminProjects({
        project_key: normalizedProject,
        scope: rolloutScope,
        ...(rolloutScope === 'tenant' ? { tenant_id: normalizedTenant } : {}),
        ...(rolloutScope === 'wave' ? { tenant_ids: parsedTenantIds } : {}),
        ...(rolloutScope === 'all'
          ? { batch_size: Math.max(1, Math.trunc(rolloutBatchSize)) }
          : {}),
        ...(rolloutWave.trim() ? { wave: rolloutWave.trim() } : {}),
        ...(rolloutNotes.trim() ? { notes: rolloutNotes.trim() } : {}),
      });
      const data = (response.data as { rolled_back?: number; skipped?: number }) || {};
      message.success(
        `Rollback completed. Rolled back: ${data.rolled_back ?? 0}, skipped: ${data.skipped ?? 0}`,
      );
      await Promise.all([loadStatus(), loadReleases()]);
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to rollback release';
      message.error(text);
    } finally {
      setLoading(false);
    }
  }, [
    loadReleases,
    loadStatus,
    parseTenantIds,
    rolloutBatchSize,
    rolloutNotes,
    rolloutProjectKey,
    rolloutScope,
    rolloutTenantId,
    rolloutTenantIdsText,
    rolloutWave,
  ]);

  const runStagedRollout = useCallback(async () => {
    const normalizedProject = rolloutProjectKey.trim();
    const normalizedReleaseId = rolloutReleaseId.trim();
    const normalizedTestTenant = rolloutTenantId.trim().toLowerCase();
    const parsedTenantIds = parseTenantIds(rolloutTenantIdsText);
    if (!normalizedProject || !normalizedReleaseId) {
      message.error('project_key and release_id are required');
      return;
    }
    if (!normalizedTestTenant) {
      message.error('test tenant_id is required for staged rollout');
      return;
    }

    setLoading(true);
    try {
      const response = await stagedRolloutAdminProjects({
        project_key: normalizedProject,
        release_id: normalizedReleaseId,
        test_tenant_id: normalizedTestTenant,
        ...(parsedTenantIds.length > 0 ? { tenant_ids: parsedTenantIds } : {}),
        batch_size: Math.max(1, Math.trunc(rolloutBatchSize)),
        ...(rolloutWave.trim() ? { wave: rolloutWave.trim() } : {}),
        ...(rolloutNotes.trim() ? { notes: rolloutNotes.trim() } : {}),
      });
      const data =
        (response.data as { total_updated?: number; wave?: string; canary_tenant_id?: string }) ||
        {};
      message.success(
        `Staged rollout completed. canary=${data.canary_tenant_id || normalizedTestTenant}, wave=${data.wave || '-'}, updated=${data.total_updated ?? 0}`,
      );
      await Promise.all([loadStatus(), loadReleases()]);
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to run staged rollout';
      message.error(text);
    } finally {
      setLoading(false);
    }
  }, [
    loadReleases,
    loadStatus,
    rolloutBatchSize,
    rolloutNotes,
    rolloutProjectKey,
    rolloutReleaseId,
    rolloutTenantId,
    rolloutTenantIdsText,
    rolloutWave,
    parseTenantIds,
  ]);

  const rollbackTenantQuick = useCallback(
    async (row: RolloutStatusRow) => {
      setLoading(true);
      try {
        const response = await rollbackAdminProjects({
          project_key: row.project_key,
          scope: 'tenant',
          tenant_id: row.tenant_id,
          notes: `quick rollback from ui (${row.release?.version || row.release_id})`,
        });
        const data = (response.data as { rolled_back?: number; skipped?: number }) || {};
        message.success(
          `Tenant ${row.tenant_id}: rolled_back=${data.rolled_back ?? 0}, skipped=${data.skipped ?? 0}`,
        );
        await Promise.all([loadStatus(), loadReleases()]);
      } catch (error) {
        const text = error instanceof Error ? error.message : 'Failed to rollback tenant';
        message.error(text);
      } finally {
        setLoading(false);
      }
    },
    [loadReleases, loadStatus],
  );

  const releaseColumns: ColumnsType<ReleaseRow> = [
    {
      title: 'Project',
      dataIndex: 'project_key',
      key: 'project_key',
      width: 200,
      sorter: true,
      sortOrder: releaseSort.field === 'project_key' ? mapOrderToAntd(releaseSort.order) : null,
    },
    {
      title: 'Version',
      dataIndex: 'version',
      key: 'version',
      width: 140,
      sorter: true,
      sortOrder: releaseSort.field === 'version' ? mapOrderToAntd(releaseSort.order) : null,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      sorter: true,
      sortOrder: releaseSort.field === 'status' ? mapOrderToAntd(releaseSort.order) : null,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: 'Updated',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 220,
      sorter: true,
      sortOrder: releaseSort.field === 'updated_at' ? mapOrderToAntd(releaseSort.order) : null,
      render: (v: string) => formatDate(v),
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, row) => (
        <Button
          size="small"
          onClick={() => {
            setRolloutProjectKey(row.project_key);
            setRolloutReleaseId(row.id);
          }}
        >
          Select
        </Button>
      ),
    },
  ];

  const statusColumns: ColumnsType<RolloutStatusRow> = [
    {
      title: 'Tenant',
      dataIndex: 'tenant_id',
      key: 'tenant_id',
      width: 200,
      sorter: true,
      sortOrder: statusSort.field === 'tenant_id' ? mapOrderToAntd(statusSort.order) : null,
    },
    {
      title: 'Project',
      dataIndex: 'project_key',
      key: 'project_key',
      width: 180,
      sorter: true,
      sortOrder: statusSort.field === 'project_key' ? mapOrderToAntd(statusSort.order) : null,
    },
    {
      title: 'Version',
      key: 'release.version',
      width: 120,
      render: (_, row) => row.release?.version || '-',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      sorter: true,
      sortOrder: statusSort.field === 'status' ? mapOrderToAntd(statusSort.order) : null,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: 'Wave',
      dataIndex: 'wave',
      key: 'wave',
      width: 120,
      sorter: true,
      sortOrder: statusSort.field === 'wave' ? mapOrderToAntd(statusSort.order) : null,
      render: (v: string | null) => v || '-',
    },
    {
      title: 'Rolled Out',
      dataIndex: 'rolled_out_at',
      key: 'rolled_out_at',
      width: 220,
      sorter: true,
      sortOrder: statusSort.field === 'rolled_out_at' ? mapOrderToAntd(statusSort.order) : null,
      render: (v: string) => formatDate(v),
    },
    {
      title: 'Action',
      key: 'action',
      width: 120,
      render: (_, row) => (
        <Button size="small" danger loading={loading} onClick={() => void rollbackTenantQuick(row)}>
          Rollback
        </Button>
      ),
    },
  ];

  if (!isAdmin) {
    return (
      <Alert
        type="warning"
        showIcon
        message="Admin role is required"
        description="This page is available only for admin users."
      />
    );
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ margin: 0 }}>
        Project Rollout
      </Typography.Title>

      <Card title="Create Release">
        <Space wrap>
          <Input
            style={{ width: 220 }}
            placeholder="project_key"
            value={projectKey}
            onChange={(event) => setProjectKey(event.target.value)}
          />
          <Input
            style={{ width: 220 }}
            placeholder="version (e.g. 1.2.3)"
            value={version}
            onChange={(event) => setVersion(event.target.value)}
          />
          <Input
            style={{ width: 160 }}
            placeholder="status"
            value={releaseStatus}
            onChange={(event) => setReleaseStatus(event.target.value)}
          />
          <Button type="primary" loading={loading} onClick={() => void createRelease()}>
            Create Release
          </Button>
        </Space>
      </Card>

      <Card title="Rollout">
        <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
          Staged mode: set `tenant_id` as canary, then click `Run Staged (Test -&gt; All)`.
        </Typography.Paragraph>
        <Space wrap>
          <Input
            style={{ width: 220 }}
            placeholder="project_key"
            value={rolloutProjectKey}
            onChange={(event) => setRolloutProjectKey(event.target.value)}
          />
          <Input
            style={{ width: 360 }}
            placeholder="release_id"
            value={rolloutReleaseId}
            onChange={(event) => setRolloutReleaseId(event.target.value)}
          />
          <Select<'tenant' | 'wave' | 'all'>
            style={{ width: 140 }}
            value={rolloutScope}
            options={[
              { label: 'Tenant', value: 'tenant' },
              { label: 'Wave', value: 'wave' },
              { label: 'All', value: 'all' },
            ]}
            onChange={(value) => setRolloutScope(value as 'tenant' | 'wave' | 'all')}
          />
          {rolloutScope === 'tenant' ? (
            <Input
              style={{ width: 220 }}
              placeholder="tenant_id"
              value={rolloutTenantId}
              onChange={(event) => setRolloutTenantId(event.target.value)}
            />
          ) : rolloutScope === 'wave' ? (
            <Input.TextArea
              style={{ width: 360 }}
              rows={2}
              placeholder="tenant_ids (comma/newline separated)"
              value={rolloutTenantIdsText}
              onChange={(event) => setRolloutTenantIdsText(event.target.value)}
            />
          ) : (
            <InputNumber
              style={{ width: 160 }}
              min={1}
              max={10000}
              value={rolloutBatchSize}
              onChange={(value) => setRolloutBatchSize(Number(value || 20))}
              placeholder="batch_size"
            />
          )}
          <Input
            style={{ width: 160 }}
            placeholder="wave"
            value={rolloutWave}
            onChange={(event) => setRolloutWave(event.target.value)}
          />
          <Input
            style={{ width: 240 }}
            placeholder="notes"
            value={rolloutNotes}
            onChange={(event) => setRolloutNotes(event.target.value)}
          />
          <Button type="primary" loading={loading} onClick={() => void runRollout()}>
            Run Rollout
          </Button>
          <Button loading={loading} onClick={() => void runStagedRollout()}>
            Run Staged (Test -&gt; All)
          </Button>
          <Button danger loading={loading} onClick={() => void runRollback()}>
            Run Rollback
          </Button>
        </Space>
      </Card>

      <Card title="Releases">
        <Space wrap style={{ marginBottom: 12 }}>
          <Input
            style={{ width: 220 }}
            placeholder="Filter project_key"
            value={releaseFilterProject}
            onChange={(event) => setReleaseFilterProject(event.target.value)}
          />
          <Input
            style={{ width: 180 }}
            placeholder="Filter status"
            value={releaseFilterStatus}
            onChange={(event) => setReleaseFilterStatus(event.target.value)}
          />
          <Button onClick={() => void loadReleases()}>Apply Filters</Button>
        </Space>
        <Table
          rowKey="id"
          dataSource={releaseRows}
          columns={releaseColumns}
          pagination={{
            current: releasePage,
            pageSize: releasePageSize,
            total: releaseTotal,
            showSizeChanger: true,
          }}
          onChange={(pagination, _filters, sorter) => {
            const nextPage = Number(pagination.current || 1);
            const nextPageSize = Number(pagination.pageSize || 8);
            setReleasePage(nextPage);
            setReleasePageSize(nextPageSize);
            const firstSorter = Array.isArray(sorter) ? sorter[0] : sorter;
            const field = String(firstSorter?.field || firstSorter?.columnKey || '').trim() as
              | 'updated_at'
              | 'created_at'
              | 'version'
              | 'project_key'
              | 'status';
            if (field) {
              setReleaseSort({
                field,
                order: mapAntdToApiOrder(firstSorter?.order),
              });
            }
          }}
          size="small"
          scroll={{ x: 960 }}
        />
      </Card>

      <Card title="Rollout Status">
        <Space wrap style={{ marginBottom: 12 }}>
          <Input
            style={{ width: 220 }}
            placeholder="Filter project_key"
            value={statusFilterProject}
            onChange={(event) => setStatusFilterProject(event.target.value)}
          />
          <Input
            style={{ width: 220 }}
            placeholder="Filter tenant_id"
            value={statusFilterTenant}
            onChange={(event) => setStatusFilterTenant(event.target.value)}
          />
          <Input
            style={{ width: 180 }}
            placeholder="Filter status"
            value={statusFilterState}
            onChange={(event) => setStatusFilterState(event.target.value)}
          />
          <Button onClick={() => void loadStatus()}>Apply Filters</Button>
        </Space>
        <Table
          rowKey="id"
          dataSource={statusRows}
          columns={statusColumns}
          pagination={{
            current: statusPage,
            pageSize: statusPageSize,
            total: statusTotal,
            showSizeChanger: true,
          }}
          onChange={(pagination, _filters, sorter) => {
            const nextPage = Number(pagination.current || 1);
            const nextPageSize = Number(pagination.pageSize || 10);
            setStatusPage(nextPage);
            setStatusPageSize(nextPageSize);
            const firstSorter = Array.isArray(sorter) ? sorter[0] : sorter;
            const field = String(firstSorter?.field || firstSorter?.columnKey || '').trim() as
              | 'updated_at'
              | 'rolled_out_at'
              | 'tenant_id'
              | 'project_key'
              | 'status'
              | 'wave';
            if (field) {
              setStatusSort({
                field,
                order: mapAntdToApiOrder(firstSorter?.order),
              });
            }
          }}
          size="small"
          scroll={{ x: 1060 }}
        />
      </Card>
    </Space>
  );
};
