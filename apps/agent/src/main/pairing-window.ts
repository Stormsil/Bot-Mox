import * as path from 'node:path';
import { BrowserWindow, ipcMain } from 'electron';
import type { AgentConfig, ConfigStore } from '../core/config-store';
import type { Logger } from '../core/logger';
import type { ProxmoxProbeData, QuickPairData } from './pairing-window/handlers';
import {
  handleQuickPair,
  handleSaveProxmoxTarget,
  handleTestProxmox,
} from './pairing-window/handlers';
import {
  getProxmoxTargetsFromConfig,
  resolveActiveTargetId,
  toTargetSummaries,
} from './pairing-window/proxmox-targets';

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
      width: 760,
      height: 860,
      minWidth: 700,
      minHeight: 780,
      resizable: true,
      minimizable: false,
      maximizable: false,
      title: 'Bot-Mox Agent — Pairing',
      backgroundColor: '#0b111a',
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

  private getHandlerDeps() {
    return {
      configStore: this.configStore,
      logger: this.logger,
      closeWindow: () => this.close(),
      onComplete: this.onComplete,
    };
  }

  private registerIpcHandlers(): void {
    ipcMain.handle('agent:quick-pair', async (_event, data: QuickPairData) => {
      return handleQuickPair(data, this.getHandlerDeps());
    });

    ipcMain.handle('agent:get-config', () => {
      const cfg = this.configStore.get();
      const targets = getProxmoxTargetsFromConfig(cfg);
      const activeTargetId = resolveActiveTargetId(cfg, targets);
      const activeTarget = activeTargetId ? targets[activeTargetId] : null;
      const serverUrl = String(cfg.serverUrl || process.env.BOTMOX_SERVER_URL || 'http://localhost')
        .trim()
        .replace(/\/+$/, '');

      return {
        serverUrl,
        proxmoxUrl: activeTarget?.url || cfg.proxmox?.url || 'https://192.168.1.100:8006',
        proxmoxUsername: activeTarget?.username || cfg.proxmox?.username || 'root',
        proxmoxNode: activeTarget?.node || cfg.proxmox?.node || 'h1',
        proxmoxPassword: String(activeTarget?.password || cfg.proxmox?.password || ''),
        hasProxmoxPassword: Boolean(String(activeTarget?.password || cfg.proxmox?.password || '')),
        proxmoxTargets: toTargetSummaries(targets, activeTargetId),
        activeTargetId,
      };
    });

    ipcMain.handle('agent:test-proxmox', async (_event, data: ProxmoxProbeData) => {
      return handleTestProxmox(data, this.getHandlerDeps());
    });

    ipcMain.handle('agent:save-proxmox-target', async (_event, data: ProxmoxProbeData) => {
      return handleSaveProxmoxTarget(data, this.getHandlerDeps());
    });
  }
}
