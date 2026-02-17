import { BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as os from 'os';
import * as http from 'http';
import * as https from 'https';
import { ApiClient, ApiError } from '../core/api-client';
import { AgentConfig, ConfigStore, ProxmoxTargetConfig } from '../core/config-store';
import { Logger } from '../core/logger';
import { executeProxmox } from '../executors/proxmox';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QuickPairData {
  serverUrl: string;
  login: string;
  password: string;
  targetId?: string;
  proxmoxUrl: string;
  proxmoxUsername: string;
  proxmoxPassword?: string;
  proxmoxNode: string;
}

interface ProxmoxProbeData {
  targetId?: string;
  proxmoxUrl: string;
  proxmoxUsername: string;
  proxmoxPassword?: string;
  proxmoxNode: string;
}

interface ProxmoxTargetSummary {
  id: string;
  label: string;
  url: string;
  username: string;
  node: string;
  hasPassword: boolean;
  password: string;
}

interface AgentRegistrationResult {
  id: string;
  name: string;
  status: string;
  paired_at: string;
  agent_token: string;
  agent_token_expires_at?: string;
}

// ---------------------------------------------------------------------------
// Pairing window
// ---------------------------------------------------------------------------

function normalizeUrl(value: unknown): string {
  return String(value || '').trim().replace(/\/+$/, '');
}

function probeBotMoxHealth(baseUrl: string): Promise<boolean> {
  return new Promise((resolve) => {
    const normalized = normalizeUrl(baseUrl);
    if (!normalized) {
      resolve(false);
      return;
    }

    let url: URL;
    try {
      url = new URL(`${normalized}/api/v1/health`);
    } catch {
      resolve(false);
      return;
    }

    const lib = url.protocol === 'https:' ? https : http;
    const port = url.port
      ? Number(url.port)
      : (url.protocol === 'https:' ? 443 : 80);

    const req = lib.request(
      {
        method: 'GET',
        hostname: url.hostname,
        port,
        path: url.pathname + url.search,
        timeout: 1_800,
      },
      (res) => {
        // Drain body to avoid socket leaks.
        res.on('data', () => {});
        res.on('end', () => {
          resolve(Number(res.statusCode) === 200);
        });
      },
    );

    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.on('error', () => resolve(false));
    req.end();
  });
}

async function resolveServerUrl(
  candidates: string[],
  logger: Logger,
): Promise<string> {
  const attempted: string[] = [];

  for (const candidate of candidates) {
    const normalized = normalizeUrl(candidate);
    if (!normalized) continue;
    if (attempted.includes(normalized)) continue;
    attempted.push(normalized);

    logger.info(`[pairing] probing serverUrl=${normalized}`);
    // eslint-disable-next-line no-await-in-loop
    const ok = await probeBotMoxHealth(normalized);
    if (ok) {
      logger.info(`[pairing] serverUrl OK: ${normalized}`);
      return normalized;
    }
  }

  throw new Error(
    `Cannot reach Bot-Mox server. Tried: ${attempted.join(', ') || '(no candidates)'}.\n` +
    `Start the stack and retry (prod-sim: http://localhost, dev: http://localhost:3001).`
  );
}

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

  private registerIpcHandlers(): void {
    ipcMain.handle('agent:quick-pair', async (_event, data: QuickPairData) => {
      return this.handleQuickPair(data);
    });

    ipcMain.handle('agent:get-config', () => {
      const cfg = this.configStore.get();
      const targets = this.getProxmoxTargetsFromConfig(cfg);
      const activeTargetId = this.resolveActiveTargetId(cfg, targets);
      const activeTarget = activeTargetId ? targets[activeTargetId] : null;
      const serverUrl = String(
        cfg.serverUrl
          || process.env.BOTMOX_SERVER_URL
          || 'http://localhost'
      ).trim().replace(/\/+$/, '');

      return {
        serverUrl,
        proxmoxUrl: activeTarget?.url || cfg.proxmox?.url || 'https://192.168.1.100:8006',
        proxmoxUsername: activeTarget?.username || cfg.proxmox?.username || 'root',
        proxmoxNode: activeTarget?.node || cfg.proxmox?.node || 'h1',
        proxmoxPassword: String(activeTarget?.password || cfg.proxmox?.password || ''),
        hasProxmoxPassword: Boolean(String(activeTarget?.password || cfg.proxmox?.password || '')),
        proxmoxTargets: this.toTargetSummaries(targets, activeTargetId),
        activeTargetId,
      };
    });

    ipcMain.handle('agent:test-proxmox', async (_event, data: ProxmoxProbeData) => {
      return this.handleTestProxmox(data);
    });

    ipcMain.handle('agent:save-proxmox-target', async (_event, data: ProxmoxProbeData) => {
      return this.handleSaveProxmoxTarget(data);
    });
  }

  private buildDefaultAgentName() {
    const hostname = String(os.hostname() || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const base = hostname || 'agent';
    const suffix = Math.random().toString(36).slice(2, 7);
    return `${base}-${suffix}`;
  }

  private buildMachineName() {
    const hostname = String(os.hostname() || '').trim();
    return hostname || this.buildDefaultAgentName();
  }

  private buildProxmoxTargetId(url: string, username: string, node: string): string {
    const normalizedUrl = String(url || '').trim();
    const normalizedUsername = String(username || '').trim().toLowerCase();
    const normalizedNode = String(node || '').trim().toLowerCase();

    let host = normalizedUrl;
    try {
      const parsed = new URL(normalizedUrl);
      host = String(parsed.host || parsed.hostname || normalizedUrl).trim().toLowerCase();
    } catch {
      host = normalizedUrl.toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');
    }

    const raw = `${host}|${normalizedUsername}|${normalizedNode || 'h1'}`;
    return raw.replace(/[^a-z0-9|._:-]/g, '').replace(/\|+/g, '|');
  }

  private buildProxmoxTargetLabel(target: Pick<ProxmoxTargetConfig, 'url' | 'username' | 'node'>): string {
    const normalizedUrl = String(target.url || '').trim();
    const normalizedUsername = String(target.username || '').trim();
    const normalizedNode = String(target.node || '').trim() || 'h1';
    let host = normalizedUrl;
    try {
      const parsed = new URL(normalizedUrl);
      host = String(parsed.host || parsed.hostname || normalizedUrl).trim();
    } catch {
      host = normalizedUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    }
    return `${host || 'proxmox'} · ${normalizedNode} · ${normalizedUsername || 'user'}`;
  }

  private normalizeTargetConfig(target: Partial<ProxmoxTargetConfig>): ProxmoxTargetConfig {
    const url = String(target.url || '').trim();
    const username = String(target.username || '').trim();
    const password = String(target.password || '');
    const node = String(target.node || '').trim() || 'h1';
    const label = String(target.label || '').trim() || this.buildProxmoxTargetLabel({ url, username, node });
    return { url, username, password, node, label };
  }

  private getProxmoxTargetsFromConfig(cfg: Partial<AgentConfig>): Record<string, ProxmoxTargetConfig> {
    const targets: Record<string, ProxmoxTargetConfig> = {};
    const existing = cfg.proxmoxTargets && typeof cfg.proxmoxTargets === 'object'
      ? cfg.proxmoxTargets
      : {};

    Object.entries(existing).forEach(([id, value]) => {
      if (!value || typeof value !== 'object') return;
      const normalized = this.normalizeTargetConfig(value as Partial<ProxmoxTargetConfig>);
      if (!normalized.url || !normalized.username) return;
      targets[String(id)] = normalized;
    });

    if (cfg.proxmox && typeof cfg.proxmox === 'object') {
      const legacy = this.normalizeTargetConfig(cfg.proxmox as Partial<ProxmoxTargetConfig>);
      if (legacy.url && legacy.username) {
        const legacyId = this.buildProxmoxTargetId(legacy.url, legacy.username, legacy.node);
        if (!targets[legacyId]) {
          targets[legacyId] = legacy;
        }
      }
    }

    return targets;
  }

  private resolveActiveTargetId(cfg: Partial<AgentConfig>, targets: Record<string, ProxmoxTargetConfig>): string | null {
    const configured = String(cfg.activeProxmoxTargetId || '').trim();
    if (configured && targets[configured]) {
      return configured;
    }
    const first = Object.keys(targets)[0];
    return first || null;
  }

  private toTargetSummaries(targets: Record<string, ProxmoxTargetConfig>, activeTargetId: string | null): ProxmoxTargetSummary[] {
    const entries = Object.entries(targets).map(([id, target]) => ({
      summary: {
        id,
        label: target.label || this.buildProxmoxTargetLabel(target),
        url: target.url,
        username: target.username,
        node: target.node,
        hasPassword: Boolean(String(target.password || '')),
        password: String(target.password || ''),
      } as ProxmoxTargetSummary,
      isActive: Boolean(activeTargetId && id === activeTargetId),
    }));

    entries.sort((first, second) => {
      if (first.isActive) return -1;
      if (second.isActive) return 1;
      return first.summary.label.localeCompare(second.summary.label);
    });

    return entries.map((entry) => entry.summary);
  }

  private buildPairedConfig(
    serverUrl: string,
    registration: AgentRegistrationResult,
    proxmoxTarget: ProxmoxTargetConfig,
    targets: Record<string, ProxmoxTargetConfig>,
  ): AgentConfig {
    const nextTargetId = this.buildProxmoxTargetId(
      proxmoxTarget.url,
      proxmoxTarget.username,
      proxmoxTarget.node,
    );
    const mergedTargets = {
      ...targets,
      [nextTargetId]: proxmoxTarget,
    };

    return {
      serverUrl,
      apiToken: registration.agent_token,
      agentId: registration.id,
      agentName: registration.name || this.buildMachineName() || this.buildDefaultAgentName(),
      proxmox: proxmoxTarget,
      proxmoxTargets: mergedTargets,
      activeProxmoxTargetId: nextTargetId,
      pairedAt: registration.paired_at || new Date().toISOString(),
      version: '0.1.0',
    };
  }

  private async handleQuickPair(data: QuickPairData): Promise<{ success: boolean; error?: string }> {
    try {
      const current = this.configStore.get();
      const resolvedServerUrl = await resolveServerUrl(
        [
          data.serverUrl,
          String(current.serverUrl || ''),
          process.env.BOTMOX_SERVER_URL || '',
          // Auto-detect for local dev convenience:
          'http://localhost',
          'http://localhost:3001',
          'http://127.0.0.1',
          'http://127.0.0.1:3001',
        ],
        this.logger,
      );
      const login = String(data.login || '').trim();
      const password = String(data.password || '');
      const selectedTargetId = String(data.targetId || '').trim();
      const targets = this.getProxmoxTargetsFromConfig(current);
      const selectedTarget = selectedTargetId ? targets[selectedTargetId] : null;
      const storedPassword = String(selectedTarget?.password || current.proxmox?.password || '');
      const typedProxmoxPassword = String(data.proxmoxPassword || '');
      const proxmoxPassword = typedProxmoxPassword || storedPassword;

      if (!login || !password) {
        throw new Error('Bot-Mox login and password are required');
      }
      if (!proxmoxPassword) {
        throw new Error('Proxmox password is required (or leave empty only if one is already saved)');
      }

      this.logger.info(`Quick pairing to ${resolvedServerUrl} using Bot-Mox account credentials`);

      const client = new ApiClient(resolvedServerUrl, '', this.logger);
      const result = await client.post<AgentRegistrationResult>('/api/v1/agents/quick-pair', {
        login,
        password,
        machine_name: this.buildMachineName(),
        name: this.buildMachineName(),
        version: '0.1.0',
        platform: process.platform,
        capabilities: ['proxmox'],
      });

      if (!result.agent_token) {
        throw new Error('Quick-pair response did not include agent auth token');
      }

      const proxmoxTarget = this.normalizeTargetConfig({
        url: data.proxmoxUrl,
        username: data.proxmoxUsername,
        password: proxmoxPassword,
        node: data.proxmoxNode,
      });

      const config = this.buildPairedConfig(resolvedServerUrl, result, proxmoxTarget, targets);
      this.configStore.save(config);
      this.logger.info(`Quick-paired successfully as agent ${result.id}`);

      this.close();
      this.onComplete?.(config);

      return { success: true };
    } catch (err) {
      const message = err instanceof ApiError
        ? `${err.code}: ${err.message}`
        : err instanceof Error ? err.message : String(err);
      this.logger.error(`Quick-pair failed: ${message}`);
      return { success: false, error: message };
    }
  }

  private async handleTestProxmox(data: ProxmoxProbeData): Promise<{ success: boolean; error?: string }> {
    try {
      const current = this.configStore.get();
      const selectedTargetId = String(data.targetId || '').trim();
      const targets = this.getProxmoxTargetsFromConfig(current);
      const selectedTarget = selectedTargetId ? targets[selectedTargetId] : null;
      const proxmoxUrl = String(data.proxmoxUrl || '').trim();
      const proxmoxUsername = String(data.proxmoxUsername || '').trim();
      const typedPassword = String(data.proxmoxPassword || '');
      const storedPassword = String(selectedTarget?.password || current.proxmox?.password || '');
      const proxmoxPassword = typedPassword || storedPassword;
      const proxmoxNode = String(data.proxmoxNode || '').trim() || 'h1';

      if (!proxmoxUrl) {
        throw new Error('Proxmox URL is required');
      }
      if (!proxmoxUsername) {
        throw new Error('Proxmox username is required');
      }
      if (!proxmoxPassword) {
        throw new Error('Proxmox password is required');
      }

      await executeProxmox(
        'proxmox.login',
        { force: true },
        {
          url: proxmoxUrl,
          username: proxmoxUsername,
          password: proxmoxPassword,
          node: proxmoxNode,
        },
        this.logger,
      );

      // Validate node-level API access too (not only auth ticket issuance).
      await executeProxmox(
        'proxmox.list-vms',
        { node: proxmoxNode },
        {
          url: proxmoxUrl,
          username: proxmoxUsername,
          password: proxmoxPassword,
          node: proxmoxNode,
        },
        this.logger,
      );

      const testedTarget = this.normalizeTargetConfig({
        url: proxmoxUrl,
        username: proxmoxUsername,
        password: proxmoxPassword,
        node: proxmoxNode,
      });
      const nextTargetId = selectedTargetId && targets[selectedTargetId]
        ? selectedTargetId
        : this.buildProxmoxTargetId(testedTarget.url, testedTarget.username, testedTarget.node);
      const mergedTargets = {
        ...targets,
        [nextTargetId]: testedTarget,
      };

      this.configStore.save({
        proxmox: testedTarget,
        proxmoxTargets: mergedTargets,
        activeProxmoxTargetId: nextTargetId,
      });

      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }

  private async handleSaveProxmoxTarget(data: ProxmoxProbeData): Promise<{ success: boolean; error?: string; targetId?: string }> {
    try {
      const current = this.configStore.get();
      const selectedTargetId = String(data.targetId || '').trim();
      const targets = this.getProxmoxTargetsFromConfig(current);
      const selectedTarget = selectedTargetId ? targets[selectedTargetId] : null;

      const proxmoxUrl = String(data.proxmoxUrl || '').trim();
      const proxmoxUsername = String(data.proxmoxUsername || '').trim();
      const proxmoxNode = String(data.proxmoxNode || '').trim() || 'h1';
      const typedPassword = String(data.proxmoxPassword || '');
      const fallbackPassword = String(selectedTarget?.password || current.proxmox?.password || '');
      const proxmoxPassword = typedPassword || fallbackPassword;

      if (!proxmoxUrl) {
        throw new Error('Proxmox URL is required');
      }
      if (!proxmoxUsername) {
        throw new Error('Proxmox username is required');
      }

      const targetConfig = this.normalizeTargetConfig({
        url: proxmoxUrl,
        username: proxmoxUsername,
        password: proxmoxPassword,
        node: proxmoxNode,
      });
      const nextTargetId = selectedTargetId && targets[selectedTargetId]
        ? selectedTargetId
        : this.buildProxmoxTargetId(targetConfig.url, targetConfig.username, targetConfig.node);
      const mergedTargets = {
        ...targets,
        [nextTargetId]: targetConfig,
      };

      this.configStore.save({
        proxmox: targetConfig,
        proxmoxTargets: mergedTargets,
        activeProxmoxTargetId: nextTargetId,
      });

      return { success: true, targetId: nextTargetId };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }
}
