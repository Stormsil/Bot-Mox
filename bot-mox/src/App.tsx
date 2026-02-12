import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Authenticated, Refine } from '@refinedev/core';
import { useNotificationProvider } from '@refinedev/antd';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { ConfigProvider, Spin, theme } from 'antd';
import { dataProvider } from './providers/data-provider';
import { authProvider } from './providers/auth-provider';
import { Header } from './components/layout/Header';
import { ResourceTree } from './components/layout/ResourceTree';
import { getThemeSettings } from './services/themeService';
import {
  applyThemePaletteToDocument,
  createDefaultThemePalettes,
  type ThemeMode,
  type ThemePalettes,
} from './theme/themePalette';
import './styles/global.css';

const THEME_STORAGE_KEY = 'botmox_theme';

const getInitialTheme = (): ThemeMode => {
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
};

interface ProxmoxLayoutProps {
  themeMode: ThemeMode;
  onThemeChange: (mode: ThemeMode) => void;
}

// Layout component в стиле Proxmox
const ProxmoxLayout: React.FC<ProxmoxLayoutProps> = ({ themeMode, onThemeChange }) => {
  return (
    <div className="proxmox-layout">
      <Header themeMode={themeMode} onThemeChange={onThemeChange} />
      <div className="proxmox-body">
        <ResourceTree />
        <main className="proxmox-content">
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
const VMListPage = lazy(async () => ({ default: (await import('./pages/vms/VMListPage')).VMListPage }));
const VMProxmoxPage = lazy(async () => ({ default: (await import('./pages/vms/sites')).VMProxmoxPage }));
const VMTinyFMPage = lazy(async () => ({ default: (await import('./pages/vms/sites')).VMTinyFMPage }));
const VMSyncThingPage = lazy(async () => ({ default: (await import('./pages/vms/sites')).VMSyncThingPage }));
const SettingsPage = lazy(async () => ({ default: (await import('./pages/settings')).SettingsPage }));
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
  const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialTheme);
  const [themePalettes, setThemePalettes] = useState<ThemePalettes>(createDefaultThemePalettes);

  useEffect(() => {
    let isMounted = true;

    getThemeSettings()
      .then((settings) => {
        if (isMounted) {
          setThemePalettes(settings.palettes);
        }
      })
      .catch((error) => {
        console.error('Error loading theme palettes:', error);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeMode);
    document.documentElement.style.colorScheme = themeMode;
    localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    applyThemePaletteToDocument(themePalettes[themeMode]);
  }, [themeMode, themePalettes]);

  const themeConfig = useMemo(() => {
    const isDark = themeMode === 'dark';
    const palette = themePalettes[themeMode];
    return {
      algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
      token: {
        colorPrimary: palette['--boxmox-color-brand-primary'],
        colorBgBase: palette['--boxmox-color-surface-base'],
        colorBgContainer: palette['--boxmox-color-surface-panel'],
        colorTextBase: palette['--boxmox-color-text-primary'],
        colorTextSecondary: palette['--boxmox-color-text-secondary'],
        colorBorder: palette['--boxmox-color-border-default'],
        borderRadius: 2,
      },
    };
  }, [themeMode, themePalettes]);

  return (
    <BrowserRouter>
      <ConfigProvider theme={themeConfig}>
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
                    <ProxmoxLayout themeMode={themeMode} onThemeChange={setThemeMode} />
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
                  element={
                    <SettingsPage
                      themePalettes={themePalettes}
                      onThemePalettesChange={setThemePalettes}
                    />
                  }
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
                <Route path="/vms/list" element={<VMListPage />} />
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
      </ConfigProvider>
    </BrowserRouter>
  );
}

export default App;
