import { app } from 'electron';
import { ConfigStore, AgentConfig } from '../core/config-store';
import { Logger } from '../core/logger';
import { ApiClient } from '../core/api-client';
import { AgentLoop } from '../core/agent-loop';
import { AgentTray } from './tray';
import { PairingWindow } from './pairing-window';

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

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

app.on('ready', () => {
  configStore = new ConfigStore();
  logger = new Logger(configStore.getConfigDir());
  logger.info('Bot-Mox Agent starting...');

  tray = new AgentTray();
  pairingWindow = new PairingWindow(configStore, logger);

  tray.setCallbacks({
    onRepair: () => showPairing(),
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
