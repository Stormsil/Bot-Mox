import { useGetIdentity } from '@refinedev/core';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Input,
  InputNumber,
  Modal,
  message,
  Progress,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiPost, apiRequest } from '../../../services/apiClient';
import styles from './AdminAccessPage.module.css';

interface TenantAccessRow {
  tenant_id: string;
  plan: string;
  premium_active: boolean;
  lifetime_premium: boolean;
  trial_ends_at: string | null;
  premium_until: string | null;
  updated_at: string;
}

interface AuditRow {
  id: string;
  actor_user_id: string | null;
  actor_tenant_id: string | null;
  action: string;
  target_tenant_id: string | null;
  payload: unknown;
  created_at: string;
}

interface AdminCreateUserResponse {
  id: string;
  email: string;
  tenant_id: string;
}

interface AdminUserRow {
  id: string;
  email: string;
  tenant_id: string | null;
  roles: string[];
  created_at: string | null;
  last_sign_in_at: string | null;
  banned_until: string | null;
  disabled: boolean;
  access: {
    plan?: string;
    premium_active?: boolean;
    lifetime_premium?: boolean;
  } | null;
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

function evaluatePasswordPolicy(value: string): Array<{ label: string; ok: boolean }> {
  const password = String(value || '');
  return [
    { label: 'At least 8 characters', ok: password.length >= 8 },
    { label: 'Contains lowercase letter', ok: /[a-z]/.test(password) },
    { label: 'Contains uppercase letter', ok: /[A-Z]/.test(password) },
    { label: 'Contains digit', ok: /[0-9]/.test(password) },
  ];
}

export const AdminAccessPage: React.FC = () => {
  const navigate = useNavigate();
  const { data: identity } = useGetIdentity<IdentityShape>();
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<TenantAccessRow[]>([]);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [auditTenantFilter, setAuditTenantFilter] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('');
  const [auditActorFilter, setAuditActorFilter] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createTenantId, setCreateTenantId] = useState('');
  const [createPremium, setCreatePremium] = useState(false);
  const [createLifetimePremium, setCreateLifetimePremium] = useState(false);
  const [createPremiumDays, setCreatePremiumDays] = useState<number>(30);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordTargetUserId, setPasswordTargetUserId] = useState('');
  const [passwordTargetEmail, setPasswordTargetEmail] = useState('');
  const [passwordValue, setPasswordValue] = useState('');
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<React.Key[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const createPasswordPolicy = useMemo(
    () => evaluatePasswordPolicy(createPassword),
    [createPassword],
  );
  const createPasswordStrong = createPasswordPolicy.every((rule) => rule.ok);
  const resetPasswordPolicy = useMemo(() => evaluatePasswordPolicy(passwordValue), [passwordValue]);
  const resetPasswordStrong = resetPasswordPolicy.every((rule) => rule.ok);

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

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const suffix = query.trim()
        ? `?q=${encodeURIComponent(query.trim())}&limit=300`
        : '?limit=300';
      const response = await apiRequest<TenantAccessRow[]>(
        `/api/v1/admin/access/tenants${suffix}`,
        {
          method: 'GET',
        },
      );
      setRows(Array.isArray(response.data) ? response.data : []);
      const usersResponse = await apiRequest<AdminUserRow[]>(
        `/api/v1/admin/access/users${suffix}`,
        {
          method: 'GET',
        },
      );
      setUsers(Array.isArray(usersResponse.data) ? usersResponse.data : []);
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to load tenant access list';
      message.error(text);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, query]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadAudit = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const params = new URLSearchParams();
      params.set('limit', '200');
      if (auditTenantFilter.trim()) params.set('tenant_id', auditTenantFilter.trim());
      if (auditActionFilter.trim()) params.set('action', auditActionFilter.trim());
      if (auditActorFilter.trim()) params.set('actor_user_id', auditActorFilter.trim());
      const audit = await apiRequest<AuditRow[]>(
        `/api/v1/admin/access/audit?${params.toString()}`,
        {
          method: 'GET',
        },
      );
      setAuditRows(Array.isArray(audit.data) ? audit.data : []);
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to load audit log';
      message.error(text);
    }
  }, [auditActionFilter, auditTenantFilter, auditActorFilter, isAdmin]);

  useEffect(() => {
    void loadAudit();
  }, [loadAudit]);

  const grant = useCallback(
    async (tenantId: string) => {
      try {
        await apiPost('/api/v1/admin/access/grant-premium', {
          tenant_id: tenantId,
          days: 30,
        });
        message.success(`Premium granted for ${tenantId}`);
        await load();
      } catch (error) {
        const text = error instanceof Error ? error.message : 'Failed to grant premium';
        message.error(text);
      }
    },
    [load],
  );

  const revoke = useCallback(
    async (tenantId: string) => {
      try {
        await apiPost('/api/v1/admin/access/revoke-premium', {
          tenant_id: tenantId,
        });
        message.success(`Premium revoked for ${tenantId}`);
        await load();
      } catch (error) {
        const text = error instanceof Error ? error.message : 'Failed to revoke premium';
        message.error(text);
      }
    },
    [load],
  );

  const openResetPasswordModal = useCallback((user: AdminUserRow) => {
    setPasswordTargetUserId(user.id);
    setPasswordTargetEmail(user.email);
    setPasswordValue('');
    setPasswordModalOpen(true);
  }, []);

  const submitResetPassword = useCallback(async () => {
    const userId = passwordTargetUserId.trim();
    const newPassword = passwordValue;
    if (!userId || !newPassword) {
      message.error('User and new password are required');
      return;
    }

    setPasswordSubmitting(true);
    try {
      await apiPost('/api/v1/auth/admin/reset-password', {
        user_id: userId,
        new_password: newPassword,
      });
      message.success(`Password updated for ${passwordTargetEmail || userId}`);
      setPasswordModalOpen(false);
      setPasswordTargetUserId('');
      setPasswordTargetEmail('');
      setPasswordValue('');
      await loadAudit();
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to reset password';
      message.error(text);
    } finally {
      setPasswordSubmitting(false);
    }
  }, [loadAudit, passwordTargetEmail, passwordTargetUserId, passwordValue]);

  const updateUserRoles = useCallback(
    async (row: AdminUserRow, nextRoles: string[]) => {
      try {
        await apiPost('/api/v1/auth/admin/set-roles', {
          user_id: row.id,
          roles: nextRoles,
        });
        message.success(`Roles updated for ${row.email}`);
        await Promise.all([load(), loadAudit()]);
      } catch (error) {
        const text = error instanceof Error ? error.message : 'Failed to update roles';
        message.error(text);
      }
    },
    [load, loadAudit],
  );

  const setUserDisabled = useCallback(
    async (row: AdminUserRow, disabled: boolean) => {
      try {
        await apiPost('/api/v1/auth/admin/set-user-disabled', {
          user_id: row.id,
          disabled,
        });
        message.success(`${disabled ? 'Disabled' : 'Enabled'} ${row.email}`);
        await Promise.all([load(), loadAudit()]);
      } catch (error) {
        const text = error instanceof Error ? error.message : 'Failed to change user status';
        message.error(text);
      }
    },
    [load, loadAudit],
  );

  const forceLogoutUser = useCallback(
    async (row: AdminUserRow) => {
      try {
        await apiPost('/api/v1/auth/admin/force-logout', {
          user_id: row.id,
        });
        message.success(`Forced logout: ${row.email}`);
        await loadAudit();
      } catch (error) {
        const text = error instanceof Error ? error.message : 'Failed to force logout';
        message.error(text);
      }
    },
    [loadAudit],
  );

  const selectedUsers = useMemo(() => {
    const set = new Set(selectedUserIds.map((value) => String(value)));
    return users.filter((user) => set.has(user.id));
  }, [selectedUserIds, users]);

  const clearSelection = useCallback(() => {
    setSelectedUserIds([]);
  }, []);

  const runBulk = useCallback(
    async (
      title: string,
      action: 'grant_premium_30d' | 'revoke_premium' | 'disable' | 'enable' | 'force_logout',
    ) => {
      if (selectedUsers.length === 0) {
        message.warning('Select at least one user');
        return;
      }

      Modal.confirm({
        title,
        content: `Selected users: ${selectedUsers.length}`,
        okText: 'Run',
        cancelText: 'Cancel',
        onOk: async () => {
          setBulkLoading(true);
          try {
            const response = await apiPost<{
              requested: number;
              success: number;
              failed: number;
              results: Array<{
                user_id: string;
                status: 'success' | 'failed';
                error?: string;
              }>;
            }>('/api/v1/admin/access/users/bulk', {
              action,
              user_ids: selectedUsers.map((row) => row.id),
            });
            const summary = response.data;
            if (summary.success > 0) {
              message.success(`Completed: ${summary.success}/${summary.requested}`);
            }
            if (summary.failed > 0) {
              message.error(
                `Failed: ${summary.failed}/${summary.requested}. Check console for details.`,
              );
              const failedRows = (summary.results || []).filter((row) => row.status === 'failed');
              console.error('[admin-bulk-errors]', failedRows);
            }
          } finally {
            setBulkLoading(false);
            clearSelection();
            await Promise.all([load(), loadAudit()]);
          }
        },
      });
    },
    [clearSelection, load, loadAudit, selectedUsers],
  );

  const createUser = useCallback(async () => {
    const email = createEmail.trim().toLowerCase();
    const password = createPassword;
    const tenantId = createTenantId.trim().toLowerCase();
    if (!email || !password) {
      message.error('Email and password are required');
      return;
    }

    try {
      const response = await apiPost<AdminCreateUserResponse>('/api/v1/auth/admin/create-user', {
        email,
        password,
        ...(tenantId ? { tenant_id: tenantId } : {}),
        roles: ['user'],
      });
      const createdTenantId = String(response.data?.tenant_id || '')
        .trim()
        .toLowerCase();
      if (!createdTenantId) {
        throw new Error('Missing tenant id in create-user response');
      }

      if (createPremium) {
        await apiPost('/api/v1/admin/access/grant-premium', {
          tenant_id: createdTenantId,
          ...(createLifetimePremium
            ? { lifetime: true }
            : { days: Math.max(1, Math.trunc(createPremiumDays)) }),
        });
      }

      message.success(`User created: ${email} (tenant: ${createdTenantId})`);
      setCreateEmail('');
      setCreatePassword('');
      setCreateTenantId('');
      setCreatePremium(false);
      setCreateLifetimePremium(false);
      setCreatePremiumDays(30);
      await Promise.all([load(), loadAudit()]);
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to create user';
      message.error(text);
    }
  }, [
    createEmail,
    createPassword,
    createPremium,
    createPremiumDays,
    createLifetimePremium,
    createTenantId,
    load,
    loadAudit,
  ]);

  const columns: ColumnsType<TenantAccessRow> = [
    {
      title: 'Tenant',
      dataIndex: 'tenant_id',
      key: 'tenant_id',
      width: 220,
    },
    {
      title: 'Plan',
      dataIndex: 'plan',
      key: 'plan',
      width: 120,
      render: (_, row) => {
        if (row.lifetime_premium) return <Tag color="gold">LIFETIME</Tag>;
        if (row.premium_active) return <Tag color="green">PREMIUM</Tag>;
        return <Tag>FREE</Tag>;
      },
    },
    {
      title: 'Trial Ends',
      dataIndex: 'trial_ends_at',
      key: 'trial_ends_at',
      width: 200,
      render: (value: string | null) => formatDate(value),
    },
    {
      title: 'Premium Until',
      dataIndex: 'premium_until',
      key: 'premium_until',
      width: 200,
      render: (value: string | null, row) =>
        row.lifetime_premium ? 'Lifetime' : formatDate(value),
    },
    {
      title: 'Updated',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 200,
      render: (value: string) => formatDate(value),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, row) => (
        <Space>
          <Button size="small" type="primary" onClick={() => void grant(row.tenant_id)}>
            Grant 30d
          </Button>
          <Button size="small" danger onClick={() => void revoke(row.tenant_id)}>
            Revoke
          </Button>
        </Space>
      ),
    },
  ];

  const auditColumns: ColumnsType<AuditRow> = [
    {
      title: 'Time',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 200,
      render: (value: string) => formatDate(value),
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      width: 220,
    },
    {
      title: 'Actor',
      dataIndex: 'actor_user_id',
      key: 'actor_user_id',
      width: 220,
      render: (value: string | null, row) => value || row.actor_tenant_id || '-',
    },
    {
      title: 'Target Tenant',
      dataIndex: 'target_tenant_id',
      key: 'target_tenant_id',
      width: 220,
      render: (value: string | null) => value || '-',
    },
  ];

  const exportAuditCsv = useCallback(() => {
    const escapeCsv = (value: unknown): string => {
      const text = String(value ?? '');
      if (/[",\n]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    };

    const header = [
      'created_at',
      'action',
      'actor_user_id',
      'actor_tenant_id',
      'target_tenant_id',
      'payload',
    ];
    const lines = [
      header.join(','),
      ...auditRows.map((row) =>
        [
          escapeCsv(row.created_at),
          escapeCsv(row.action),
          escapeCsv(row.actor_user_id),
          escapeCsv(row.actor_tenant_id),
          escapeCsv(row.target_tenant_id),
          escapeCsv(JSON.stringify(row.payload ?? {})),
        ].join(','),
      ),
    ];
    const csv = lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    link.download = `admin-audit-${stamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  }, [auditRows]);

  const usersColumns: ColumnsType<AdminUserRow> = [
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      width: 260,
    },
    {
      title: 'Tenant',
      dataIndex: 'tenant_id',
      key: 'tenant_id',
      width: 220,
      render: (value: string | null) => value || '-',
    },
    {
      title: 'Roles',
      dataIndex: 'roles',
      key: 'roles',
      width: 220,
      render: (value: string[]) => {
        if (!Array.isArray(value) || value.length === 0) return '-';
        return (
          <Space size={4} wrap>
            {value.map((role) => (
              <Tag key={role}>{role}</Tag>
            ))}
          </Space>
        );
      },
    },
    {
      title: 'Access',
      dataIndex: 'access',
      key: 'access',
      width: 180,
      render: (access: AdminUserRow['access']) => {
        if (!access) return <Tag>NONE</Tag>;
        if (access.lifetime_premium) return <Tag color="gold">LIFETIME</Tag>;
        if (access.premium_active) return <Tag color="green">PREMIUM</Tag>;
        return <Tag>{String(access.plan || 'free').toUpperCase()}</Tag>;
      },
    },
    {
      title: 'User Status',
      key: 'disabled',
      width: 160,
      render: (_, row) => {
        if (row.disabled) return <Tag color="red">DISABLED</Tag>;
        return <Tag color="green">ACTIVE</Tag>;
      },
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 200,
      render: (value: string | null) => formatDate(value),
    },
    {
      title: 'Last sign in',
      dataIndex: 'last_sign_in_at',
      key: 'last_sign_in_at',
      width: 200,
      render: (value: string | null) => formatDate(value),
    },
    {
      title: 'Banned Until',
      dataIndex: 'banned_until',
      key: 'banned_until',
      width: 200,
      render: (value: string | null) => formatDate(value),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 500,
      render: (_, row) => (
        <Space wrap>
          <Button size="small" onClick={() => openResetPasswordModal(row)}>
            Set Password
          </Button>
          {row.disabled ? (
            <Button size="small" onClick={() => void setUserDisabled(row, false)}>
              Enable
            </Button>
          ) : (
            <Button size="small" danger onClick={() => void setUserDisabled(row, true)}>
              Disable
            </Button>
          )}
          <Button size="small" onClick={() => void forceLogoutUser(row)}>
            Force Logout
          </Button>
          {Array.isArray(row.roles) &&
          row.roles
            .map((role) =>
              String(role || '')
                .trim()
                .toLowerCase(),
            )
            .includes('admin') ? (
            <Button
              size="small"
              onClick={() =>
                void updateUserRoles(
                  row,
                  (() => {
                    const next = row.roles
                      .map((role) =>
                        String(role || '')
                          .trim()
                          .toLowerCase(),
                      )
                      .filter((role) => role && role !== 'admin');
                    return next.length > 0 ? next : ['user'];
                  })(),
                )
              }
            >
              Remove Admin
            </Button>
          ) : (
            <Button
              size="small"
              onClick={() =>
                void updateUserRoles(
                  row,
                  Array.from(
                    new Set([
                      ...row.roles
                        .map((role) =>
                          String(role || '')
                            .trim()
                            .toLowerCase(),
                        )
                        .filter(Boolean),
                      'admin',
                    ]),
                  ),
                )
              }
            >
              Make Admin
            </Button>
          )}
          <Button
            size="small"
            type="primary"
            disabled={!row.tenant_id}
            onClick={() => row.tenant_id && void grant(row.tenant_id)}
          >
            Grant 30d
          </Button>
          <Button
            size="small"
            danger
            disabled={!row.tenant_id}
            onClick={() => row.tenant_id && void revoke(row.tenant_id)}
          >
            Revoke
          </Button>
        </Space>
      ),
    },
  ];

  if (!isAdmin) {
    return (
      <div className={styles.root}>
        <Alert
          type="error"
          showIcon
          message="Admin access required"
          description="This page is available only for admin users."
        />
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <Card className={styles.tableCard}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            Admin Access Control
          </Typography.Title>

          <Card size="small" title="Create User">
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <div className={styles.formGrid}>
                <Input
                  placeholder="Email"
                  value={createEmail}
                  onChange={(event) => setCreateEmail(event.target.value)}
                />
                <Input.Password
                  placeholder="Password"
                  value={createPassword}
                  onChange={(event) => setCreatePassword(event.target.value)}
                />
                <Input
                  placeholder="Tenant ID (optional, auto-generated if empty)"
                  value={createTenantId}
                  onChange={(event) => setCreateTenantId(event.target.value)}
                />
              </div>
              {createPassword.trim() ? (
                <div className={styles.passwordPolicy}>
                  <Progress
                    percent={Math.round(
                      (createPasswordPolicy.filter((rule) => rule.ok).length /
                        createPasswordPolicy.length) *
                        100,
                    )}
                    size="small"
                    status={createPasswordStrong ? 'success' : 'active'}
                    showInfo={false}
                  />
                  <Space direction="vertical" size={2}>
                    {createPasswordPolicy.map((rule) => (
                      <Typography.Text
                        key={rule.label}
                        type={rule.ok ? 'success' : 'secondary'}
                        className={styles.passwordRule}
                      >
                        {rule.ok ? '✓' : '•'} {rule.label}
                      </Typography.Text>
                    ))}
                  </Space>
                </div>
              ) : null}
              <Space wrap>
                <Checkbox
                  checked={createPremium}
                  onChange={(event) => setCreatePremium(event.target.checked)}
                >
                  Grant premium immediately
                </Checkbox>
                {createPremium ? (
                  <Checkbox
                    checked={createLifetimePremium}
                    onChange={(event) => setCreateLifetimePremium(event.target.checked)}
                  >
                    Lifetime premium
                  </Checkbox>
                ) : null}
                {createPremium && !createLifetimePremium ? (
                  <Space>
                    <Typography.Text type="secondary">Days:</Typography.Text>
                    <InputNumber
                      min={1}
                      max={3650}
                      value={createPremiumDays}
                      onChange={(value) =>
                        setCreatePremiumDays(typeof value === 'number' ? value : 30)
                      }
                    />
                  </Space>
                ) : null}
                <Button
                  type="primary"
                  onClick={() => void createUser()}
                  disabled={!createEmail.trim() || !createPasswordStrong}
                >
                  Create User
                </Button>
              </Space>
            </Space>
          </Card>

          <Alert
            type="info"
            showIcon
            message="Platform operations moved"
            description={
              <Space>
                <Typography.Text>
                  Runtime metrics and tenant-wide secret rotation are now in a dedicated page.
                </Typography.Text>
                <Button size="small" onClick={() => navigate('/admin/operations')}>
                  Open Admin Operations
                </Button>
              </Space>
            }
          />

          <div className={styles.toolbar}>
            <Input.Search
              placeholder="Search tenant id"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onSearch={() => void load()}
              allowClear
              style={{ maxWidth: 320 }}
            />
            <Button onClick={() => void load()} loading={loading}>
              Refresh
            </Button>
          </div>

          <Table<TenantAccessRow>
            rowKey="tenant_id"
            columns={columns}
            dataSource={rows}
            loading={loading}
            pagination={{ pageSize: 20 }}
            scroll={{ x: 1100 }}
          />

          <Typography.Title level={5} style={{ margin: 0 }}>
            Users
          </Typography.Title>
          <Space wrap>
            <Typography.Text type="secondary">Selected: {selectedUsers.length}</Typography.Text>
            <Button
              loading={bulkLoading}
              onClick={() =>
                void runBulk('Grant premium (30d) for selected users?', 'grant_premium_30d')
              }
            >
              Bulk Grant 30d
            </Button>
            <Button
              loading={bulkLoading}
              danger
              onClick={() => void runBulk('Revoke premium for selected users?', 'revoke_premium')}
            >
              Bulk Revoke
            </Button>
            <Button
              loading={bulkLoading}
              danger
              onClick={() => void runBulk('Disable selected users?', 'disable')}
            >
              Bulk Disable
            </Button>
            <Button
              loading={bulkLoading}
              onClick={() => void runBulk('Enable selected users?', 'enable')}
            >
              Bulk Enable
            </Button>
            <Button
              loading={bulkLoading}
              onClick={() => void runBulk('Force logout selected users?', 'force_logout')}
            >
              Bulk Force Logout
            </Button>
            <Button onClick={clearSelection}>Clear Selection</Button>
          </Space>
          <Table<AdminUserRow>
            rowKey="id"
            columns={usersColumns}
            dataSource={users}
            loading={loading}
            rowSelection={{
              selectedRowKeys: selectedUserIds,
              onChange: (next) => setSelectedUserIds(next),
            }}
            pagination={{ pageSize: 20 }}
            scroll={{ x: 1700 }}
          />

          <Typography.Title level={5} style={{ margin: 0 }}>
            Audit Log
          </Typography.Title>
          <div className={styles.toolbar}>
            <Space wrap>
              <Input
                placeholder="Filter by target tenant"
                value={auditTenantFilter}
                onChange={(event) => setAuditTenantFilter(event.target.value)}
                style={{ width: 260 }}
              />
              <Input
                placeholder="Filter by action"
                value={auditActionFilter}
                onChange={(event) => setAuditActionFilter(event.target.value)}
                style={{ width: 260 }}
              />
              <Input
                placeholder="Filter by actor user id"
                value={auditActorFilter}
                onChange={(event) => setAuditActorFilter(event.target.value)}
                style={{ width: 260 }}
              />
              <Button onClick={() => void loadAudit()}>Apply Filters</Button>
            </Space>
            <Space>
              <Button onClick={() => void loadAudit()}>Refresh Audit</Button>
              <Button onClick={exportAuditCsv}>Export CSV</Button>
            </Space>
          </div>
          <Table<AuditRow>
            rowKey="id"
            columns={auditColumns}
            dataSource={auditRows}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 900 }}
          />
        </Space>
      </Card>

      <Modal
        title={`Set Password: ${passwordTargetEmail || passwordTargetUserId}`}
        open={passwordModalOpen}
        onCancel={() => {
          setPasswordModalOpen(false);
          setPasswordTargetUserId('');
          setPasswordTargetEmail('');
          setPasswordValue('');
        }}
        onOk={() => void submitResetPassword()}
        confirmLoading={passwordSubmitting}
        okText="Save Password"
        okButtonProps={{ disabled: !resetPasswordStrong || passwordSubmitting }}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Typography.Text type="secondary">
            This updates password immediately via Supabase Admin API.
          </Typography.Text>
          <Input.Password
            placeholder="New password (min 8 chars)"
            value={passwordValue}
            onChange={(event) => setPasswordValue(event.target.value)}
          />
          {passwordValue.trim() ? (
            <div className={styles.passwordPolicy}>
              <Progress
                percent={Math.round(
                  (resetPasswordPolicy.filter((rule) => rule.ok).length /
                    resetPasswordPolicy.length) *
                    100,
                )}
                size="small"
                status={resetPasswordStrong ? 'success' : 'active'}
                showInfo={false}
              />
              <Space direction="vertical" size={2}>
                {resetPasswordPolicy.map((rule) => (
                  <Typography.Text
                    key={rule.label}
                    type={rule.ok ? 'success' : 'secondary'}
                    className={styles.passwordRule}
                  >
                    {rule.ok ? '✓' : '•'} {rule.label}
                  </Typography.Text>
                ))}
              </Space>
            </div>
          ) : null}
        </Space>
      </Modal>
    </div>
  );
};
