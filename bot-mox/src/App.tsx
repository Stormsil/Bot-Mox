import React, { Suspense, lazy, useEffect } from 'react';
import { Authenticated, Refine } from '@refinedev/core';
import { useNotificationProvider } from '@refinedev/antd';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { App as AntdApp, ConfigProvider, Spin } from 'antd';
import { dataProvider } from './providers/data-provider';
import { authProvider } from './providers/auth-provider';
import { Header } from './components/layout/Header';
import { ResourceTree } from './components/layout/ResourceTree';
import { useThemeRuntime, ThemeRuntimeProvider } from './theme/themeRuntime';
import './styles/global.css';
import shellStyles from './AppShell.module.css';

// Layout component в стиле Proxmox
const ProxmoxLayout: React.FC = () => {
  const { themeMode, visualSettings } = useThemeRuntime();
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setPrefersReducedMotion(media.matches);
    update();

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', update);
      return () => media.removeEventListener('change', update);
    }

    media.addListener(update);
    return () => media.removeListener(update);
  }, []);

  const isVisualImage = visualSettings.enabled && visualSettings.mode === 'image' && Boolean(visualSettings.backgroundImageUrl);
  const overlayColor = themeMode === 'dark' ? visualSettings.overlayColorDark : visualSettings.overlayColorLight;
  const effectiveBlur = prefersReducedMotion ? 0 : visualSettings.blurPx;
  const backgroundStyle: React.CSSProperties = isVisualImage ? {
    backgroundImage: `url(${visualSettings.backgroundImageUrl})`,
    backgroundPosition: visualSettings.backgroundPosition === 'top' ? 'top center' : 'center center',
    backgroundSize: visualSettings.backgroundSize,
    filter: effectiveBlur > 0 ? `blur(${effectiveBlur}px)` : undefined,
    transform: effectiveBlur > 0 ? 'scale(1.02)' : undefined,
  } : {};
  const overlayStyle: React.CSSProperties = isVisualImage ? {
    backgroundColor: overlayColor,
    opacity: Math.max(0, Math.min(1, visualSettings.overlayOpacity + visualSettings.dimStrength)),
  } : {};

  return (
    <div className={shellStyles['proxmox-layout']}>
      <Header />
      <div className={shellStyles['proxmox-body']}>
        {isVisualImage ? (
          <div className={shellStyles['theme-visual-layer']} aria-hidden="true">
            <div className={shellStyles['theme-visual-image']} style={backgroundStyle} />
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

const DatacenterPage = lazy(async () => ({ default: (await import('./pages/datacenter')).DatacenterPage }));
const ProjectPage = lazy(async () => ({ default: (await import('./pages/project')).ProjectPage }));
const BotPage = lazy(async () => ({ default: (await import('./pages/bot')).BotPage }));
const FinancePage = lazy(async () => ({ default: (await import('./pages/finance')).FinancePage }));
const NotesPage = lazy(async () => ({ default: (await import('./pages/notes')).NotesPage }));
const LicensesPage = lazy(async () => ({ default: (await import('./pages/licenses')).LicensesPage }));
const ProxiesPage = lazy(async () => ({ default: (await import('./pages/proxies')).ProxiesPage }));
const SubscriptionsPage = lazy(async () => ({ default: (await import('./pages/subscriptions')).SubscriptionsPage }));
const VMsPage = lazy(async () => ({ default: (await import('./pages/vms')).VMsPage }));
const VMProxmoxPage = lazy(async () => ({ default: (await import('./pages/vms/sites')).VMProxmoxPage }));
const VMTinyFMPage = lazy(async () => ({ default: (await import('./pages/vms/sites')).VMTinyFMPage }));
const VMSyncThingPage = lazy(async () => ({ default: (await import('./pages/vms/sites')).VMSyncThingPage }));
const SettingsPage = lazy(async () => ({ default: (await import('./pages/settings')).SettingsPage }));
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

function App() {
  return (
    <ThemeRuntimeProvider>
      <AppWithTheme />
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
            notificationProvider={useNotificationProvider}
            resources={[
              { name: 'bots', list: '/' },
              { name: 'licenses', list: '/licenses' },
              { name: 'proxies', list: '/proxies' },
              { name: 'subscriptions', list: '/subscriptions' },
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
                    <Authenticated key="protected-routes" fallback={<Navigate to="/login" replace />}>
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

                  {/* Archive */}
                  <Route path="/archive/banned" element={<ArchivePage />} />

                  {/* System */}
                  <Route
                    path="/settings"
                    element={<SettingsPage />}
                  />
                  <Route path="/notes" element={<NotesPage />} />
                  <Route path="/workspace/calendar" element={<WorkspaceCalendarPage />} />
                  <Route path="/workspace/kanban" element={<WorkspaceKanbanPage />} />
                  <Route path="/notes/reminders" element={<Navigate to="/workspace/calendar" replace />} />

                  {/* Licenses, Proxies, Subscriptions, VMs */}
                  <Route path="/licenses" element={<LicensesPage />} />
                  <Route path="/proxies" element={<ProxiesPage />} />
                  <Route path="/subscriptions" element={<SubscriptionsPage />} />
                  <Route path="/vms" element={<VMsPage />} />
                  <Route path="/vms/list" element={<Navigate to="/vms" replace />} />
                  <Route path="/vms/unattend-profiles" element={<Navigate to="/vms" replace />} />
                  <Route path="/vms/sites/proxmox" element={<VMProxmoxPage />} />
                  <Route path="/vms/sites/tinyfm" element={<VMTinyFMPage />} />
                  <Route path="/vms/sites/syncthing" element={<VMSyncThingPage />} />
                  <Route path="/vms/proxmox" element={<Navigate to="/vms/sites/proxmox" replace />} />
                  <Route path="/vms/tinyfm" element={<Navigate to="/vms/sites/tinyfm" replace />} />
                  <Route path="/vms/syncthing" element={<Navigate to="/vms/sites/syncthing" replace />} />
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
