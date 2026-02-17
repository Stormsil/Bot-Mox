import * as fs from 'fs';
import * as path from 'path';
import { app, safeStorage } from 'electron';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProxmoxConfig {
  url: string;
  username: string;
  password: string;
  node: string;
}

export interface ProxmoxTargetConfig extends ProxmoxConfig {
  label?: string;
}

export interface AgentConfig {
  serverUrl: string;
  apiToken: string;
  agentId: string;
  agentName: string;
  proxmox: ProxmoxConfig;
  proxmoxTargets?: Record<string, ProxmoxTargetConfig>;
  activeProxmoxTargetId?: string;
  pairedAt: string;
  version: string;
}

interface PersistedProxmoxConfig extends Omit<Partial<ProxmoxTargetConfig>, 'password'> {
  password?: string;
  passwordEncrypted?: string;
}

interface PersistedAgentConfig extends Omit<Partial<AgentConfig>, 'apiToken' | 'proxmox'> {
  storageVersion?: number;
  payloadEncrypted?: string;
  apiToken?: string;
  apiTokenEncrypted?: string;
  proxmox?: PersistedProxmoxConfig;
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

  private canEncrypt(): boolean {
    try {
      return safeStorage.isEncryptionAvailable();
    } catch {
      return false;
    }
  }

  private encryptString(value: string): string | null {
    if (!value) return '';
    if (!this.canEncrypt()) return null;
    try {
      return safeStorage.encryptString(value).toString('base64');
    } catch {
      return null;
    }
  }

  private decryptString(ciphertext: string): string | null {
    if (!ciphertext) return '';
    if (!this.canEncrypt()) return null;
    try {
      const buf = Buffer.from(ciphertext, 'base64');
      return safeStorage.decryptString(buf);
    } catch {
      return null;
    }
  }

  private encryptRuntimePayload(runtimeConfig: Partial<AgentConfig>): string | null {
    try {
      return this.encryptString(JSON.stringify(runtimeConfig || {}));
    } catch {
      return null;
    }
  }

  private decryptRuntimePayload(payloadEncrypted: string): Partial<AgentConfig> | null {
    const decrypted = this.decryptString(payloadEncrypted);
    if (decrypted === null) return null;
    try {
      const parsed = JSON.parse(decrypted);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed as Partial<AgentConfig>;
    } catch {
      return null;
    }
  }

  private toPersistedConfig(runtimeConfig: Partial<AgentConfig>): PersistedAgentConfig {
    const runtime = runtimeConfig || {};

    const fullEncryptedPayload = this.encryptRuntimePayload(runtime);
    if (fullEncryptedPayload !== null) {
      return {
        storageVersion: 2,
        payloadEncrypted: fullEncryptedPayload,
      };
    }

    const persisted: PersistedAgentConfig = { ...runtime };

    if (runtime.proxmox) {
      persisted.proxmox = { ...runtime.proxmox };
    }

    if (typeof runtime.apiToken === 'string') {
      const encrypted = this.encryptString(runtime.apiToken);
      if (encrypted !== null) {
        persisted.apiTokenEncrypted = encrypted;
        delete persisted.apiToken;
      }
    }

    if (runtime.proxmox && typeof runtime.proxmox.password === 'string') {
      const encryptedPassword = this.encryptString(runtime.proxmox.password);
      if (encryptedPassword !== null) {
        persisted.proxmox = {
          ...(persisted.proxmox || {}),
          passwordEncrypted: encryptedPassword,
        };
        delete persisted.proxmox.password;
      }
    }

    return persisted;
  }

  private fromPersistedConfig(persistedConfig: PersistedAgentConfig): {
    runtime: Partial<AgentConfig>;
    shouldRewrite: boolean;
  } {
    const persisted = persistedConfig || {};
    const hasEncryptedPayload = typeof persisted.payloadEncrypted === 'string' && persisted.payloadEncrypted.length > 0;
    if (hasEncryptedPayload) {
      const decryptedRuntime = this.decryptRuntimePayload(String(persisted.payloadEncrypted || ''));
      if (decryptedRuntime) {
        return {
          runtime: decryptedRuntime,
          shouldRewrite: false,
        };
      }
    }

    let shouldRewrite = false;

    const runtime: Partial<AgentConfig> = { ...persisted } as Partial<AgentConfig>;
    if (persisted.proxmox) {
      runtime.proxmox = { ...(persisted.proxmox as ProxmoxConfig) };
    }

    if (typeof persisted.apiTokenEncrypted === 'string' && persisted.apiTokenEncrypted) {
      const decrypted = this.decryptString(persisted.apiTokenEncrypted);
      if (decrypted !== null) {
        runtime.apiToken = decrypted;
      } else if (typeof persisted.apiToken === 'string') {
        runtime.apiToken = persisted.apiToken;
      }
    }

    if (!runtime.apiToken && typeof persisted.apiToken === 'string') {
      runtime.apiToken = persisted.apiToken;
      if (this.canEncrypt()) {
        shouldRewrite = true;
      }
    }

    if (runtime.proxmox && typeof persisted.proxmox?.passwordEncrypted === 'string' && persisted.proxmox.passwordEncrypted) {
      const decryptedPassword = this.decryptString(persisted.proxmox.passwordEncrypted);
      if (decryptedPassword !== null) {
        runtime.proxmox.password = decryptedPassword;
      } else if (typeof persisted.proxmox?.password === 'string') {
        runtime.proxmox.password = persisted.proxmox.password;
      }
    }

    if (runtime.proxmox && !runtime.proxmox.password && typeof persisted.proxmox?.password === 'string') {
      runtime.proxmox.password = persisted.proxmox.password;
      if (this.canEncrypt()) {
        shouldRewrite = true;
      }
    }

    if (!hasEncryptedPayload && this.canEncrypt()) {
      shouldRewrite = true;
    }

    delete (runtime as PersistedAgentConfig).apiTokenEncrypted;
    delete (runtime as PersistedAgentConfig).storageVersion;
    delete (runtime as PersistedAgentConfig).payloadEncrypted;
    if (runtime.proxmox) {
      delete (runtime.proxmox as PersistedProxmoxConfig).passwordEncrypted;
    }

    return {
      runtime,
      shouldRewrite,
    };
  }

  private writeRuntimeConfig(runtimeConfig: Partial<AgentConfig>): void {
    this.ensureDir();
    const persisted = this.toPersistedConfig(runtimeConfig);
    fs.writeFileSync(this.configPath, JSON.stringify(persisted, null, 2), 'utf-8');
  }

  load(): Partial<AgentConfig> {
    if (this.data) return this.data;
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf-8');
        const parsed = JSON.parse(raw) as PersistedAgentConfig;
        const normalized = this.fromPersistedConfig(parsed);
        this.data = normalized.runtime;
        if (normalized.shouldRewrite) {
          this.writeRuntimeConfig(normalized.runtime);
        }
        return this.data!;
      }
    } catch {
      // Corrupted config — start fresh
    }
    this.data = {};
    return this.data;
  }

  save(config: Partial<AgentConfig>): void {
    const current = this.load();
    const incomingProxmox: Partial<ProxmoxConfig> = config.proxmox || {};
    const incomingPassword = typeof incomingProxmox.password === 'string'
      ? incomingProxmox.password
      : undefined;
    const keepExistingPassword = incomingPassword === '' && typeof current.proxmox?.password === 'string';

    const mergedProxmox = {
      ...(current.proxmox || {}),
      ...incomingProxmox,
    };
    if (keepExistingPassword && current.proxmox?.password) {
      mergedProxmox.password = current.proxmox.password;
    }
    const merged: Partial<AgentConfig> = { ...current, ...config };
    if (Object.keys(mergedProxmox).length > 0) {
      merged.proxmox = mergedProxmox as ProxmoxConfig;
    }
    this.data = merged;
    this.writeRuntimeConfig(merged);
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
