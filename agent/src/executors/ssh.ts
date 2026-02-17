import { Client as SSHClient, ConnectConfig } from 'ssh2';
import { ProxmoxConfig } from '../core/config-store';
import { Logger } from '../core/logger';

const SSH_DEFAULT_PORT = 22;
const SSH_DEFAULT_TIMEOUT_MS = 20_000;
const SSH_TIMEOUT_MIN_MS = 1_000;
const SSH_TIMEOUT_MAX_MS = 180_000;

const SSH_COMMAND_ALLOWLIST = [
  /^qm\s+(status|start|stop|shutdown|reset|suspend|resume)\s+\d+$/i,
  /^qm\s+sendkey\s+\d+\s+[A-Za-z0-9_+\-]+$/i,
  /^cat\s+\/etc\/pve\/qemu-server\/\d+\.conf$/i,
  /^pvesh\s+get\s+\/nodes\/[^\s]+\/qemu\/?$/i,
  /^pvesh\s+get\s+\/cluster\/resources\/?$/i,
];

export interface ResolvedSshConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  privateKey: string;
  authMode: 'password' | 'key' | null;
  configured: boolean;
}

export interface SshExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

function makeTaggedError(code: string, message: string): Error {
  return new Error(`${String(code || '').trim()}: ${String(message || '').trim()}`);
}

function parseHostFromProxmoxUrl(url: string): string {
  const normalized = String(url || '').trim();
  if (!normalized) return '';

  try {
    const parsed = new URL(normalized);
    return String(parsed.hostname || '').trim();
  } catch {
    const withoutProto = normalized.replace(/^[a-z]+:\/\//i, '');
    const hostPortPath = withoutProto.split('/')[0] || '';
    const host = hostPortPath.split(':')[0] || '';
    return host.trim();
  }
}

function normalizeSshUsername(value: string): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const atIndex = raw.indexOf('@');
  if (atIndex <= 0) return raw;
  return raw.slice(0, atIndex).trim();
}

function normalizePort(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return SSH_DEFAULT_PORT;
  const integer = Math.trunc(parsed);
  if (integer < 1 || integer > 65535) return SSH_DEFAULT_PORT;
  return integer;
}

function normalizeTimeoutMs(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return SSH_DEFAULT_TIMEOUT_MS;
  return Math.max(SSH_TIMEOUT_MIN_MS, Math.min(SSH_TIMEOUT_MAX_MS, Math.trunc(parsed)));
}

function trimOutput(value: string): string {
  return String(value || '').replace(/\s+$/g, '');
}

function mapSshConnectionError(error: unknown): Error {
  const raw = error instanceof Error ? error.message : String(error || 'Unknown SSH error');
  const message = String(raw || '').trim();

  if (/SSH_TIMEOUT:/i.test(message)) {
    return makeTaggedError('SSH_UNREACHABLE', 'SSH connection timed out. Check host, port, and network reachability.');
  }

  if (/all configured authentication methods failed|permission denied|authentication failure|unable to authenticate/i.test(message)) {
    return makeTaggedError('SSH_AUTH_FAILED', 'Possible wrong SSH username/password or key.');
  }

  if (/timed out|etimedout|econnrefused|ehostunreach|enetunreach|enotfound|no route to host|handshake/i.test(message)) {
    return makeTaggedError('SSH_UNREACHABLE', `SSH host is unreachable: ${message}`);
  }

  return makeTaggedError('SSH_EXEC_ERROR', message || 'SSH command failed');
}

function ensureConfigured(config: ResolvedSshConfig): void {
  if (!config.host || !config.username || !config.authMode) {
    throw makeTaggedError(
      'SSH_REQUIRED',
      'SSH is not configured for this computer. Add valid SSH credentials (or Proxmox password) and retry.',
    );
  }
}

function runSshExec(
  sshConfig: ResolvedSshConfig,
  command: string,
  timeoutMs: number,
): Promise<SshExecResult> {
  return new Promise((resolve, reject) => {
    const client = new SSHClient();
    let settled = false;

    const finish = (err?: unknown, result?: SshExecResult) => {
      if (settled) return;
      settled = true;
      try {
        client.end();
      } catch {
        // Ignore teardown errors.
      }
      if (err !== undefined) {
        reject(err);
        return;
      }
      resolve(result || { stdout: '', stderr: '', exitCode: 255 });
    };

    const timeout = setTimeout(() => {
      finish(makeTaggedError('SSH_TIMEOUT', `SSH command timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    client.once('ready', () => {
      client.exec(command, (execError, stream) => {
        if (execError) {
          clearTimeout(timeout);
          finish(execError);
          return;
        }

        let stdout = '';
        let stderr = '';
        let exitCode = 0;

        stream.on('data', (chunk: Buffer | string) => {
          stdout += chunk.toString();
        });

        stream.stderr.on('data', (chunk: Buffer | string) => {
          stderr += chunk.toString();
        });

        stream.once('close', (code?: number) => {
          clearTimeout(timeout);
          exitCode = Number.isFinite(code as number) ? Number(code) : 0;
          finish(undefined, {
            stdout: trimOutput(stdout),
            stderr: trimOutput(stderr),
            exitCode,
          });
        });

        stream.once('error', (streamError: Error) => {
          clearTimeout(timeout);
          finish(streamError);
        });
      });
    });

    client.once('error', (connectError: Error) => {
      clearTimeout(timeout);
      finish(connectError);
    });

    const connectOptions: ConnectConfig = {
      host: sshConfig.host,
      port: sshConfig.port,
      username: sshConfig.username,
      readyTimeout: Math.min(timeoutMs, 30_000),
      tryKeyboard: false,
    };

    if (sshConfig.privateKey) {
      connectOptions.privateKey = sshConfig.privateKey;
    }
    if (sshConfig.password) {
      connectOptions.password = sshConfig.password;
    }

    client.connect(connectOptions);
  });
}

export function isSshCommandAllowed(command: string): boolean {
  const normalized = String(command || '').trim();
  if (!normalized) return false;
  return SSH_COMMAND_ALLOWLIST.some((rule) => rule.test(normalized));
}

export function resolveSshConfig(payload: Record<string, unknown>, proxmoxConfig: ProxmoxConfig): ResolvedSshConfig {
  const payloadHost = String(payload.sshHost || '').trim();
  const host = payloadHost || parseHostFromProxmoxUrl(proxmoxConfig.url);

  const payloadPort = payload.sshPort !== undefined ? payload.sshPort : payload.port;
  const port = normalizePort(payloadPort);

  const payloadUsername = String(payload.sshUsername || '').trim();
  const username = payloadUsername || normalizeSshUsername(proxmoxConfig.username);

  const payloadPassword = typeof payload.sshPassword === 'string'
    ? payload.sshPassword
    : undefined;
  const password = payloadPassword !== undefined
    ? String(payloadPassword)
    : String(proxmoxConfig.password || '');

  const privateKey = String(payload.sshPrivateKey || '').trim();
  const authMode = privateKey ? 'key' : (password ? 'password' : null);

  return {
    host,
    port,
    username,
    password,
    privateKey,
    authMode,
    configured: Boolean(host && username && authMode),
  };
}

export async function executeSshCommand(params: {
  command: string;
  payload: Record<string, unknown>;
  proxmoxConfig: ProxmoxConfig;
  logger: Logger;
  timeoutMs?: unknown;
  enforceAllowlist?: boolean;
  allowUnsafe?: boolean;
}): Promise<SshExecResult & { ssh: Omit<ResolvedSshConfig, 'password' | 'privateKey'> }> {
  const command = String(params.command || '').trim();
  if (!command) {
    throw makeTaggedError('BAD_REQUEST', 'SSH command is required');
  }

  const sshConfig = resolveSshConfig(params.payload, params.proxmoxConfig);
  ensureConfigured(sshConfig);

  if (params.enforceAllowlist && !params.allowUnsafe && !isSshCommandAllowed(command)) {
    throw makeTaggedError(
      'SSH_COMMAND_FORBIDDEN',
      'SSH command is not allowlisted. Use a dedicated API action instead.',
    );
  }

  const timeoutMs = normalizeTimeoutMs(params.timeoutMs);

  try {
    params.logger.info(`SSH exec on ${sshConfig.username}@${sshConfig.host}:${sshConfig.port} (${command.slice(0, 120)})`);
    const result = await runSshExec(sshConfig, command, timeoutMs);
    return {
      ...result,
      ssh: {
        host: sshConfig.host,
        port: sshConfig.port,
        username: sshConfig.username,
        authMode: sshConfig.authMode,
        configured: sshConfig.configured,
      },
    };
  } catch (error) {
    throw mapSshConnectionError(error);
  }
}

export function buildSshStatus(config: ResolvedSshConfig): {
  configured: boolean;
  host: string;
  port: number;
  username: string;
  mode: 'password' | 'key' | 'none';
} {
  return {
    configured: config.configured,
    host: config.host,
    port: config.port,
    username: config.username,
    mode: config.authMode || 'none',
  };
}
