import { app, shell } from 'electron';
import { AgentLoop } from '../core/agent-loop';
import { ApiClient } from '../core/api-client';
import { type AgentConfig, ConfigStore } from '../core/config-store';
import { createDiagnosticBundle } from '../core/diagnostics';
import { Logger } from '../core/logger';
import { PairingWindow } from './pairing-window';
import { AgentTray } from './tray';

// ---------------------------------------------------------------------------
// Single instance lock
// ---------------------------------------------------------------------------

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

// ---------------------------------------------------------------------------
// App state
// ---------------------------------------------------------------------------

let configStore: ConfigStore;
let logger: Logger;
let tray: AgentTray;
let pairingWindow: PairingWindow;
let agentLoop: AgentLoop | null = null;

// ---------------------------------------------------------------------------
// Start agent loop with given config
// ---------------------------------------------------------------------------

function startAgent(config: AgentConfig): void {
  if (agentLoop) {
    agentLoop.stop();
  }

  const apiClient = new ApiClient(config.serverUrl, config.apiToken, logger);
  agentLoop = new AgentLoop(config, apiClient, logger);

  agentLoop.setStatusCallback((status, message) => {
    tray.updateStatus(status, message);
  });

  tray.setAgentName(config.agentName || config.agentId);
  tray.updateStatus('connecting');

  agentLoop.start().catch((err) => {
    logger.error('Agent loop failed to start:', err);
    tray.updateStatus('error', err instanceof Error ? err.message : String(err));
  });
}

// ---------------------------------------------------------------------------
// Show pairing window
// ---------------------------------------------------------------------------

function showPairing(): void {
  if (agentLoop) {
    agentLoop.stop();
    agentLoop = null;
  }
  tray.updateStatus('idle');
  pairingWindow.open((config) => {
    startAgent(config);
  });
}

function logout(): void {
  if (agentLoop) {
    agentLoop.stop();
    agentLoop = null;
  }
  configStore.clear();
  logger.info('User logged out — config cleared');
  tray.setAgentName('Not paired');
  tray.updateStatus('idle');
  showPairing();
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

// Silence EPIPE on stdout/stderr — Electron on Windows has no TTY
process.stdout?.on?.('error', () => {});
process.stderr?.on?.('error', () => {});

app.on('ready', () => {
  configStore = new ConfigStore();
  logger = new Logger(configStore.getConfigDir());
  logger.info('Bot-Mox Agent starting...');

  tray = new AgentTray();
  pairingWindow = new PairingWindow(configStore, logger);

  tray.setCallbacks({
    onCreateDiagnosticBundle: () => {
      try {
        const bundlePath = createDiagnosticBundle({
          appVersion: app.getVersion(),
          config: configStore.get(),
          configDir: configStore.getConfigDir(),
          logPath: logger.getLogPath(),
        });
        logger.info('Diagnostic bundle created', {
          bundle_path: bundlePath,
          event_name: 'agent.diagnostics.bundle.created',
        });
        shell.showItemInFolder(bundlePath);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error('Failed to create diagnostic bundle', {
          error: message,
          event_name: 'agent.diagnostics.bundle.failed',
        });
      }
    },
    onRepair: () => showPairing(),
    onLogout: () => logout(),
    onQuit: () => {
      logger.info('User requested quit');
      if (agentLoop) agentLoop.stop();
      logger.close();
      tray.destroy();
      app.quit();
    },
    logPath: logger.getLogPath(),
  });

  if (configStore.isConfigured()) {
    const config = configStore.get() as AgentConfig;
    logger.info(`Resuming as agent ${config.agentId}`);
    startAgent(config);
  } else {
    logger.info('No config found, showing pairing window');
    showPairing();
  }
});

// Prevent app from quitting when all windows are closed (tray-only)
app.on('window-all-closed', () => {
  // Do nothing — keep app alive as tray-only
});

// Focus pairing window if second instance is launched
app.on('second-instance', () => {
  showPairing();
});
