import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = String(env.VITE_API_BASE_URL || 'http://localhost:3001').replace(/\/+$/, '');

  return {
    plugins: [react()],
    build: {
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;

            if (id.includes('react/') || id.includes('react-dom') || id.includes('scheduler')) {
              return 'vendor-react';
            }

            if (id.includes('react-router')) {
              return 'vendor-router';
            }

            if (id.includes('antd') || id.includes('@ant-design') || id.includes('rc-')) {
              return 'vendor-antd';
            }

            if (id.includes('recharts')) {
              return 'vendor-charts';
            }

            if (
              id.includes('@codemirror/')
              || id.includes('/codemirror/')
              || id.includes('@lezer/')
            ) {
              return 'vendor-codemirror';
            }

            if (id.includes('monaco-editor') || id.includes('@monaco-editor')) {
              return 'vendor-editor';
            }

            if (id.includes('firebase')) {
              return 'vendor-firebase';
            }

            if (id.includes('@refinedev')) {
              return 'vendor-refine';
            }

            return undefined;
          },
        },
      },
    },
    server: {
      proxy: {
        '^/$': {
          target: proxyTarget,
          changeOrigin: true,
          ws: true,
          bypass: (req) => {
            const rawUrl = req.url || '/';
            let isProxmoxConsoleRoute = false;

            try {
              const parsed = new URL(rawUrl, 'http://localhost');
              const query = parsed.searchParams;
              isProxmoxConsoleRoute = query.has('console') || query.has('novnc') || query.has('xtermjs');
            } catch {
              isProxmoxConsoleRoute = false;
            }

            if (isProxmoxConsoleRoute) {
              return;
            }

            return rawUrl;
          },
        },
        '/api': { target: proxyTarget, changeOrigin: true, ws: true },
        '/api/v1': { target: proxyTarget, changeOrigin: true, ws: true },
        '/proxmox-ui': { target: proxyTarget, changeOrigin: true, ws: true },
        '/tinyfm-ui': { target: proxyTarget, changeOrigin: true, ws: true },
        '/syncthing-ui': { target: proxyTarget, changeOrigin: true, ws: true },
        '/ws': { target: proxyTarget, changeOrigin: true, ws: true },
        '/api2': { target: proxyTarget, changeOrigin: true, ws: true },
        '/pve2': { target: proxyTarget, changeOrigin: true, ws: true },
        '/PVE': { target: proxyTarget, changeOrigin: true, ws: true },
        '/novnc': { target: proxyTarget, changeOrigin: true, ws: true },
        '/xtermjs': { target: proxyTarget, changeOrigin: true, ws: true },
        '/pwt': { target: proxyTarget, changeOrigin: true, ws: true },
        '/widgettoolkit': { target: proxyTarget, changeOrigin: true, ws: true },
        '/proxmox-widget-toolkit': { target: proxyTarget, changeOrigin: true, ws: true },
        '/proxmoxlib.js': { target: proxyTarget, changeOrigin: true, ws: true },
        '/qrcode.min.js': { target: proxyTarget, changeOrigin: true, ws: true },
      },
    },
  };
});
