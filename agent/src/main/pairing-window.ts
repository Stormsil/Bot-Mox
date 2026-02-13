import { BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { ApiClient, ApiError } from '../core/api-client';
import { AgentConfig, ConfigStore } from '../core/config-store';
import { Logger } from '../core/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PairingData {
  serverUrl: string;
  apiToken: string;
  pairingCode: string;
  agentName: string;
  proxmoxUrl: string;
  proxmoxUsername: string;
  proxmoxPassword: string;
  proxmoxNode: string;
}

// ---------------------------------------------------------------------------
// Pairing window
// ---------------------------------------------------------------------------

export class PairingWindow {
  private win: BrowserWindow | null = null;
  private onComplete: ((config: AgentConfig) => void) | null = null;

  constructor(
    private configStore: ConfigStore,
    private logger: Logger,
  ) {
    this.registerIpcHandlers();
  }

  open(onComplete: (config: AgentConfig) => void): void {
    if (this.win && !this.win.isDestroyed()) {
      this.win.focus();
      return;
    }

    this.onComplete = onComplete;

    this.win = new BrowserWindow({
      width: 480,
      height: 620,
      resizable: false,
      minimizable: false,
      maximizable: false,
      title: 'Bot-Mox Agent — Pairing',
      webPreferences: {
        preload: path.join(__dirname, '..', 'ui', 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    this.win.setMenuBarVisibility(false);
    this.win.loadFile(path.join(__dirname, '..', 'ui', 'pairing.html'));

    this.win.on('closed', () => {
      this.win = null;
    });
  }

  close(): void {
    if (this.win && !this.win.isDestroyed()) {
      this.win.close();
    }
  }

  private registerIpcHandlers(): void {
    ipcMain.handle('agent:pair', async (_event, data: PairingData) => {
      return this.handlePairing(data);
    });

    ipcMain.handle('agent:get-config', () => {
      const cfg = this.configStore.get();
      // Return safe subset (no password)
      return {
        serverUrl: cfg.serverUrl || '',
        apiToken: cfg.apiToken ? '***' : '',
        agentName: cfg.agentName || '',
        proxmoxUrl: cfg.proxmox?.url || 'https://192.168.1.100:8006',
        proxmoxUsername: cfg.proxmox?.username || 'root',
        proxmoxNode: cfg.proxmox?.node || 'h1',
      };
    });
  }

  private async handlePairing(data: PairingData): Promise<{ success: boolean; error?: string }> {
    try {
      this.logger.info(`Pairing to ${data.serverUrl} with code ${data.pairingCode}`);

      const client = new ApiClient(data.serverUrl, data.apiToken, this.logger);

      // Register agent
      const result = await client.post<{
        id: string;
        name: string;
        status: string;
        paired_at: string;
      }>('/api/v1/agents/register', {
        pairing_code: data.pairingCode,
        version: '0.1.0',
        platform: process.platform,
        capabilities: ['proxmox'],
      });

      const config: AgentConfig = {
        serverUrl: data.serverUrl,
        apiToken: data.apiToken,
        agentId: result.id,
        agentName: data.agentName || result.name || 'Agent',
        proxmox: {
          url: data.proxmoxUrl,
          username: data.proxmoxUsername,
          password: data.proxmoxPassword,
          node: data.proxmoxNode,
        },
        pairedAt: result.paired_at || new Date().toISOString(),
        version: '0.1.0',
      };

      this.configStore.save(config);
      this.logger.info(`Paired successfully as agent ${result.id}`);

      this.close();
      this.onComplete?.(config);

      return { success: true };
    } catch (err) {
      const message = err instanceof ApiError
        ? `${err.code}: ${err.message}`
        : err instanceof Error ? err.message : String(err);
      this.logger.error(`Pairing failed: ${message}`);
      return { success: false, error: message };
    }
  }
}
