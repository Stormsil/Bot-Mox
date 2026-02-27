import { useNotificationProvider } from '@refinedev/antd';
import { Authenticated, Refine, useGetIdentity } from '@refinedev/core';
import routerProvider from '@refinedev/react-router';
import { App as AntdApp, Button, ConfigProvider, Spin, Tag, Typography } from 'antd';
import type React from 'react';
import { lazy, Suspense, useEffect, useMemo } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import { QueryProvider } from './app/providers/QueryProvider';
import { Header } from './components/layout/Header';
import { ResourceTree } from './components/layout/ResourceTree';
import { ADMIN_APP_URL } from './config/env';
import { authProvider } from './providers/auth-provider';
import { dataProvider } from './providers/data-provider';
import { ThemeRuntimeProvider, useThemeRuntime } from './theme/themeRuntime';
import './styles/global.css';
import shellStyles from './AppShell.module.css';

interface AccessSnapshot {
  access_tier?: 'free' | 'trial' | 'premium' | 'admin';
  write_access?: boolean;
  trial_ends_at?: string | null;
}

interface IdentitySnapshot {
  access?: AccessSnapshot;
}

function calcRemainingHours(value: string | null | undefined): number | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const endsAt = new Date(raw);
  if (Number.isNaN(endsAt.getTime())) return null;
  const diffMs = endsAt.getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / (60 * 60 * 1000)));
}

const AccessStatusBanner: React.FC = () => {
  const { data: identity } = useGetIdentity<IdentitySnapshot>();
  const navigate = useNavigate();
  const access = identity?.access;
  const tier = String(access?.access_tier || 'free')
    .trim()
    .toLowerCase();
  const canWrite = access?.write_access === true;
  const remainingTrialHours = calcRemainingHours(access?.trial_ends_at || null);

  if (tier === 'admin') {
    return null;
  }

  if (tier === 'premium' && canWrite) {
    return (
      <div className={shellStyles['access-banner']}>
        <Typography.Text>
          Access
          <Tag color="green" bordered={false} style={{ marginInline: 8 }}>
            PREMIUM
          </Tag>
          Write operations are enabled.
        </Typography.Text>
      </div>
    );
  }

  if (tier === 'trial' && canWrite) {
    return (
      <div className={shellStyles['access-banner']}>
        <Typography.Text>
          Access
          <Tag color="blue" bordered={false} style={{ marginInline: 8 }}>
            TRIAL
          </Tag>
          Write operations are enabled.
          {remainingTrialHours !== null ? ` Remaining: ~${remainingTrialHours}h.` : ''}
        </Typography.Text>
      </div>
    );
  }

  return (
    <div className={shellStyles['access-banner']}>
      <Typography.Text>
        Access
        <Tag color="default" bordered={false} style={{ marginInline: 8 }}>
          FREE / READ ONLY
        </Tag>
        Navigation is available, but write operations are locked.
      </Typography.Text>
      <Button type="primary" size="small" onClick={() => navigate('/billing')}>
        Upgrade Access
      </Button>
    </div>
  );
};

// Layout component в стиле Proxmox
const ProxmoxLayout: React.FC = () => {
  const { themeMode, visualSettings } = useThemeRuntime();
  const isVisualImage =
    visualSettings.enabled &&
    visualSettings.mode === 'image' &&
    Boolean(visualSettings.backgroundImageUrl);
  const overlayColor =
    themeMode === 'dark' ? visualSettings.overlayColorDark : visualSettings.overlayColorLight;
  const isBlurred = isVisualImage && visualSettings.blurPx > 0;

  // Keep these memoized so React doesn't re-apply identical inline styles on unrelated renders.
  const backgroundStyle = useMemo<React.CSSProperties>(() => {
    if (!isVisualImage) return {};
    return {
      backgroundImage: `url(${visualSettings.backgroundImageUrl})`,
      backgroundPosition:
        visualSettings.backgroundPosition === 'top' ? 'top center' : 'center center',
      backgroundSize: visualSettings.backgroundSize,
      filter: isBlurred ? `blur(${visualSettings.blurPx}px)` : undefined,
      transform: isBlurred ? 'scale(1.02)' : undefined,
    };
  }, [
    isBlurred,
    isVisualImage,
    visualSettings.backgroundImageUrl,
    visualSettings.backgroundPosition,
    visualSettings.backgroundSize,
    visualSettings.blurPx,
  ]);

  const overlayStyle = useMemo<React.CSSProperties>(() => {
    if (!isVisualImage) return {};
    return {
      backgroundColor: overlayColor,
      opacity: Math.max(0, Math.min(1, visualSettings.overlayOpacity + visualSettings.dimStrength)),
    };
  }, [isVisualImage, overlayColor, visualSettings.dimStrength, visualSettings.overlayOpacity]);

  return (
    <div className={shellStyles['proxmox-layout']}>
      <Header />
      <AccessStatusBanner />
      <div className={shellStyles['proxmox-body']}>
        {isVisualImage ? (
          <div className={shellStyles['theme-visual-layer']} aria-hidden="true">
            <div
              className={[
                shellStyles['theme-visual-image'],
                isBlurred ? shellStyles['theme-visual-imageBlurred'] : '',
              ].join(' ')}
              style={backgroundStyle}
            />
            <div className={shellStyles['theme-visual-overlay']} style={overlayStyle} />
          </div>
        ) : null}
        <ResourceTree />
        <main className={shellStyles['proxmox-content']}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

const ArchivePage: React.FC = () => (
  <div style={{ padding: 24, color: 'var(--boxmox-color-text-primary)' }}>
    <h2>Archive Page (Coming Soon)</h2>
  </div>
);

const DatacenterPage = lazy(async () => ({
  default: (await import('./pages/datacenter')).DatacenterPage,
}));
const ProjectPage = lazy(async () => ({ default: (await import('./pages/project')).ProjectPage }));
const BotPage = lazy(async () => ({ default: (await import('./pages/bot')).BotPage }));
const FinancePage = lazy(async () => ({ default: (await import('./pages/finance')).FinancePage }));
const BillingPage = lazy(async () => ({ default: (await import('./pages/billing')).BillingPage }));
const NotesPage = lazy(async () => ({ default: (await import('./pages/notes')).NotesPage }));
const LicensesPage = lazy(async () => ({
  default: (await import('./pages/licenses')).LicensesPage,
}));
const ProxiesPage = lazy(async () => ({ default: (await import('./pages/proxies')).ProxiesPage }));
const SubscriptionsPage = lazy(async () => ({
  default: (await import('./pages/subscriptions')).SubscriptionsPage,
}));
const VMsPage = lazy(async () => ({ default: (await import('./pages/vms')).VMsPage }));
const SettingsPage = lazy(async () => ({
  default: (await import('./pages/settings')).SettingsPage,
}));
// UnattendProfilesPage removed — profiles are now managed inside VM Settings modal
const WorkspaceCalendarPage = lazy(async () => ({
  default: (await import('./pages/workspace/calendar')).WorkspaceCalendarPage,
}));
const WorkspaceKanbanPage = lazy(async () => ({
  default: (await import('./pages/workspace/kanban')).WorkspaceKanbanPage,
}));
const LoginPage = lazy(async () => ({ default: (await import('./pages/login')).LoginPage }));

const RouteFallback: React.FC = () => (
  <div style={{ minHeight: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <Spin size="large" />
  </div>
);

const AdminRedirectPage: React.FC = () => {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.location.assign(`${ADMIN_APP_URL}/admin/access`);
  }, []);
  return <RouteFallback />;
};

function App() {
  return (
    <ThemeRuntimeProvider>
      <QueryProvider>
        <AppWithTheme />
      </QueryProvider>
    </ThemeRuntimeProvider>
  );
}

function AppWithTheme() {
  const { themeConfig } = useThemeRuntime();
  useEffect(() => {
    ConfigProvider.config({
      holderRender: (children) => (
        <ConfigProvider theme={themeConfig}>
          <AntdApp>{children}</AntdApp>
        </ConfigProvider>
      ),
    });
  }, [themeConfig]);

  return (
    <BrowserRouter>
      <ConfigProvider theme={themeConfig}>
        <AntdApp>
          <Refine
            dataProvider={dataProvider}
            authProvider={authProvider}
            routerProvider={routerProvider}
            notificationProvider={useNotificationProvider}
            resources={[
              { name: 'bots', list: '/' },
              {
                name: 'licenses',
                list: '/licenses',
                create: '/licenses',
                edit: '/licenses',
                show: '/licenses',
              },
              {
                name: 'proxies',
                list: '/proxies',
                create: '/proxies',
                edit: '/proxies',
                show: '/proxies',
              },
              {
                name: 'subscriptions',
                list: '/subscriptions',
                create: '/subscriptions',
                edit: '/subscriptions',
                show: '/subscriptions',
              },
              { name: 'notes', list: '/notes' },
            ]}
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
                      <ProxmoxLayout />
                    </Authenticated>
                  }
                >
                  {/* Datacenter */}
                  <Route path="/" element={<DatacenterPage />} />

                  {/* Projects */}
                  <Route path="/project/:id" element={<ProjectPage />} />

                  {/* Bots */}
                  <Route path="/bot/:id" element={<BotPage />} />

                  {/* Finance - глобальная страница */}
                  <Route path="/finance" element={<FinancePage />} />
                  <Route path="/billing" element={<BillingPage />} />
                  <Route path="/admin/*" element={<AdminRedirectPage />} />

                  {/* Archive */}
                  <Route path="/archive/banned" element={<ArchivePage />} />

                  {/* System */}
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/notes" element={<NotesPage />} />
                  <Route path="/workspace/calendar" element={<WorkspaceCalendarPage />} />
                  <Route path="/workspace/kanban" element={<WorkspaceKanbanPage />} />
                  <Route
                    path="/notes/reminders"
                    element={<Navigate to="/workspace/calendar" replace />}
                  />

                  {/* Licenses, Proxies, Subscriptions, VMs */}
                  <Route path="/licenses" element={<LicensesPage />} />
                  <Route path="/proxies" element={<ProxiesPage />} />
                  <Route path="/subscriptions" element={<SubscriptionsPage />} />
                  <Route path="/vms" element={<VMsPage />} />
                  <Route path="/vms/list" element={<Navigate to="/vms" replace />} />
                  <Route path="/vms/unattend-profiles" element={<Navigate to="/vms" replace />} />
                </Route>

                <Route
                  element={
                    <Authenticated key="public-routes" fallback={<Outlet />}>
                      <Navigate to="/" replace />
                    </Authenticated>
                  }
                >
                  <Route path="/login" element={<LoginPage />} />
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </Refine>
        </AntdApp>
      </ConfigProvider>
    </BrowserRouter>
  );
}

export default App;
