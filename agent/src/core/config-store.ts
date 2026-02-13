import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProxmoxConfig {
  url: string;
  username: string;
  password: string;
  node: string;
}

export interface AgentConfig {
  serverUrl: string;
  apiToken: string;
  agentId: string;
  agentName: string;
  proxmox: ProxmoxConfig;
  pairedAt: string;
  version: string;
}

// ---------------------------------------------------------------------------
// ConfigStore — persists agent config to %APPDATA%/botmox-agent/config.json
// ---------------------------------------------------------------------------

export class ConfigStore {
  private configDir: string;
  private configPath: string;
  private data: Partial<AgentConfig> | null = null;

  constructor() {
    this.configDir = path.join(app.getPath('appData'), 'botmox-agent');
    this.configPath = path.join(this.configDir, 'config.json');
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
  }

  load(): Partial<AgentConfig> {
    if (this.data) return this.data;
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf-8');
        this.data = JSON.parse(raw);
        return this.data!;
      }
    } catch {
      // Corrupted config — start fresh
    }
    this.data = {};
    return this.data;
  }

  save(config: Partial<AgentConfig>): void {
    this.ensureDir();
    this.data = { ...this.load(), ...config };
    fs.writeFileSync(this.configPath, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  get(): Partial<AgentConfig> {
    return this.load();
  }

  isConfigured(): boolean {
    const c = this.load();
    return !!(c.serverUrl && c.apiToken && c.agentId);
  }

  getConfigDir(): string {
    this.ensureDir();
    return this.configDir;
  }

  clear(): void {
    this.data = {};
    if (fs.existsSync(this.configPath)) {
      fs.unlinkSync(this.configPath);
    }
  }
}
