import { Refine } from '@refinedev/core';
import { RefineKbar, RefineKbarProvider } from '@refinedev/kbar';
import { useNotificationProvider } from '@refinedev/antd';
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import { dataProvider } from './providers/data-provider';
import { authProvider } from './providers/auth-provider';
import { FirebaseProvider } from './contexts/FirebaseContext';
import { Header } from './components/layout/Header';
import { ResourceTree } from './components/layout/ResourceTree';
import { DatacenterPage } from './pages/datacenter';
import { BotPage } from './pages/bot';
import { FinancePage } from './pages/finance';
import { NotesPage } from './pages/notes';
import { LicensesPage } from './pages/licenses';
import { ProxiesPage } from './pages/proxies';
import { SubscriptionsPage } from './pages/subscriptions';
import { SettingsPage } from './pages/settings';
import './styles/global.css';

// Layout component в стиле Proxmox
const ProxmoxLayout: React.FC = () => {
  return (
    <div className="proxmox-layout">
      <Header />
      <div className="proxmox-body">
        <ResourceTree />
        <main className="proxmox-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

// Placeholder pages
const ProjectPage: React.FC = () => (
  <div style={{ padding: 24, color: '#fff' }}>
    <h2>Project Page (Coming Soon)</h2>
  </div>
);

const MetricsPage: React.FC = () => (
  <div style={{ padding: 24, color: '#fff' }}>
    <h2>Metrics Page (Coming Soon)</h2>
  </div>
);

const ArchivePage: React.FC = () => (
  <div style={{ padding: 24, color: '#fff' }}>
    <h2>Archive Page (Coming Soon)</h2>
  </div>
);

const LogsPage: React.FC = () => (
  <div style={{ padding: 24, color: '#fff' }}>
    <h2>Logs Page (Coming Soon)</h2>
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <ConfigProvider theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#e57000',
          colorBgBase: '#1e1e1e',
          colorTextBase: '#ffffff',
          colorBorder: '#444444',
          borderRadius: 0,
        },
      }}>
        <RefineKbarProvider>
          <FirebaseProvider>
            <Refine
              dataProvider={dataProvider}
              authProvider={authProvider}
              notificationProvider={useNotificationProvider}
              options={{
                syncWithLocation: true,
                warnWhenUnsavedChanges: true,
              }}
            >
              <Routes>
                <Route element={<ProxmoxLayout />}>
                  {/* Datacenter */}
                  <Route path="/" element={<DatacenterPage />} />

                  {/* Projects */}
                  <Route path="/project/:id" element={<ProjectPage />} />

                  {/* Bots */}
                  <Route path="/bot/:id" element={<BotPage />} />

                  {/* Metrics */}
                  <Route path="/metrics/dashboard" element={<MetricsPage />} />

                  {/* Finance - глобальная страница */}
                  <Route path="/finance" element={<FinancePage />} />

                  {/* Archive */}
                  <Route path="/archive/banned" element={<ArchivePage />} />

                  {/* System */}
                  <Route path="/logs" element={<LogsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/notes" element={<NotesPage />} />

                  {/* Licenses, Proxies, Subscriptions */}
                  <Route path="/licenses" element={<LicensesPage />} />
                  <Route path="/proxies" element={<ProxiesPage />} />
                  <Route path="/subscriptions" element={<SubscriptionsPage />} />
                </Route>
              </Routes>
              <RefineKbar />
            </Refine>
          </FirebaseProvider>
        </RefineKbarProvider>
      </ConfigProvider>
    </BrowserRouter>
  );
}

export default App;
