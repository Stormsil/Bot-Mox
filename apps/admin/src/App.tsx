import { Authenticated, Refine, useGetIdentity } from '@refinedev/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntdApp, Button, ConfigProvider, Layout, Space, Spin, Typography } from 'antd';
import type React from 'react';
import { lazy, Suspense, useMemo } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import { authProvider } from './providers/auth-provider';

const { Header, Content } = Layout;
const AUTH_TOKEN_KEY = 'botmox.admin.auth.token';
const AUTH_IDENTITY_KEY = 'botmox.admin.auth.identity';
const AUTH_VERIFY_TS_KEY = 'botmox.admin.auth.verify_at';

const LoginPage = lazy(async () => ({ default: (await import('./pages/login')).LoginPage }));
const AdminAccessPage = lazy(async () => ({
  default: (await import('./pages/admin/access')).AdminAccessPage,
}));
const AdminProjectsPage = lazy(async () => ({
  default: (await import('./pages/admin/projects')).AdminProjectsPage,
}));
const AdminOperationsPage = lazy(async () => ({
  default: (await import('./pages/admin/operations')).AdminOperationsPage,
}));

const RouteFallback: React.FC = () => (
  <div style={{ minHeight: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <Spin size="large" />
  </div>
);

const AdminOnlyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data: identity, isLoading } = useGetIdentity<{ roles?: string[] }>();
  if (isLoading) {
    return <RouteFallback />;
  }
  const roles = Array.isArray(identity?.roles)
    ? identity.roles.map((value) =>
        String(value || '')
          .trim()
          .toLowerCase(),
      )
    : [];
  const isAdmin =
    roles.includes('admin') || roles.includes('owner') || roles.includes('service_role');
  if (!isAdmin) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const AdminShell: React.FC = () => {
  const navigate = useNavigate();
  const { data: identity } = useGetIdentity<{ email?: string; roles?: string[] }>();
  const email = String(identity?.email || '').trim();
  const handleLogout = useMemo(
    () => () => {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AUTH_IDENTITY_KEY);
      localStorage.removeItem(AUTH_VERIFY_TS_KEY);
      void authProvider.logout?.({});
      navigate('/login', { replace: true });
    },
    [navigate],
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingInline: 16,
          borderBottom: '1px solid var(--botmox-color-border-default)',
          background: 'var(--botmox-color-surface-elevated)',
        }}
      >
        <Space>
          <Typography.Text strong>Bot-Mox Admin Console</Typography.Text>
          <Button size="small" onClick={() => navigate('/admin/access')}>
            Access
          </Button>
          <Button size="small" onClick={() => navigate('/admin/projects')}>
            Projects
          </Button>
          <Button size="small" onClick={() => navigate('/admin/operations')}>
            Operations
          </Button>
        </Space>
        <Space>
          <Typography.Text type="secondary">{email || 'admin'}</Typography.Text>
          <Button size="small" onClick={handleLogout}>
            Logout
          </Button>
        </Space>
      </Header>
      <Content style={{ padding: 16 }}>
        <Outlet />
      </Content>
    </Layout>
  );
};

const App: React.FC = () => {
  const queryClient = useMemo(() => new QueryClient(), []);
  const themeConfig = useMemo(
    () => ({
      token: {
        colorPrimary: '#1f73b7',
      },
    }),
    [],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ConfigProvider theme={themeConfig}>
          <AntdApp>
            <Refine
              authProvider={authProvider}
              options={{
                syncWithLocation: true,
                warnWhenUnsavedChanges: true,
                disableTelemetry: true,
              }}
            >
              <Suspense fallback={<RouteFallback />}>
                <Routes>
                  <Route
                    element={
                      <Authenticated
                        key="protected-routes"
                        fallback={<Navigate to="/login" replace />}
                      >
                        <AdminShell />
                      </Authenticated>
                    }
                  >
                    <Route
                      path="/admin/access"
                      element={
                        <AdminOnlyRoute>
                          <AdminAccessPage />
                        </AdminOnlyRoute>
                      }
                    />
                    <Route
                      path="/admin/projects"
                      element={
                        <AdminOnlyRoute>
                          <AdminProjectsPage />
                        </AdminOnlyRoute>
                      }
                    />
                    <Route
                      path="/admin/operations"
                      element={
                        <AdminOnlyRoute>
                          <AdminOperationsPage />
                        </AdminOnlyRoute>
                      }
                    />
                    <Route path="/" element={<Navigate to="/admin/access" replace />} />
                  </Route>
                  <Route
                    element={
                      <Authenticated key="public-routes" fallback={<Outlet />}>
                        <Navigate to="/admin/access" replace />
                      </Authenticated>
                    }
                  >
                    <Route path="/login" element={<LoginPage />} />
                  </Route>
                  <Route path="*" element={<Navigate to="/admin/access" replace />} />
                </Routes>
              </Suspense>
            </Refine>
          </AntdApp>
        </ConfigProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
