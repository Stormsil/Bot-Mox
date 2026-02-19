import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { AgentConfig } from './config-store';

interface DiagnosticBundleInput {
  appVersion: string;
  config: Partial<AgentConfig>;
  configDir: string;
  logPath: string;
}

interface DiagnosticLogFile {
  modified_at: string;
  path: string;
  size_bytes: number;
  tail: string[];
}

function safeIso(value: Date): string {
  return value.toISOString();
}

function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function readTailLines(filePath: string, lineCount = 200): string[] {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const lines = raw.split(/\r?\n/).filter((line) => line.length > 0);
    if (lines.length <= lineCount) {
      return lines;
    }
    return lines.slice(lines.length - lineCount);
  } catch {
    return [];
  }
}

function collectLogFiles(logPath: string, maxRotations = 5): DiagnosticLogFile[] {
  const candidates: string[] = [logPath];
  for (let index = 1; index <= maxRotations; index += 1) {
    candidates.push(`${logPath}.${index}`);
  }

  const files: DiagnosticLogFile[] = [];
  for (const candidate of candidates) {
    if (!fileExists(candidate)) {
      continue;
    }
    try {
      const stat = fs.statSync(candidate);
      files.push({
        modified_at: safeIso(stat.mtime),
        path: candidate,
        size_bytes: stat.size,
        tail: readTailLines(candidate),
      });
    } catch {
      // Ignore single-file failures to keep diagnostics best-effort.
    }
  }

  return files;
}

function summarizeConfig(config: Partial<AgentConfig>): Record<string, unknown> {
  const targets =
    config.proxmoxTargets && typeof config.proxmoxTargets === 'object'
      ? Object.entries(config.proxmoxTargets).map(([id, target]) => ({
          has_password: Boolean(target?.password),
          id,
          label: target?.label || null,
          node: target?.node || null,
          url: target?.url || null,
          username: target?.username || null,
        }))
      : [];

  return {
    active_proxmox_target_id: config.activeProxmoxTargetId || null,
    agent_id: config.agentId || null,
    agent_name: config.agentName || null,
    has_api_token: Boolean(config.apiToken),
    paired_at: config.pairedAt || null,
    proxmox: config.proxmox
      ? {
          has_password: Boolean(config.proxmox.password),
          node: config.proxmox.node || null,
          url: config.proxmox.url || null,
          username: config.proxmox.username || null,
        }
      : null,
    proxmox_targets: targets,
    server_url: config.serverUrl || null,
    version: config.version || null,
  };
}

export function createDiagnosticBundle(input: DiagnosticBundleInput): string {
  const now = new Date();
  const diagnosticsDir = path.join(input.configDir, 'diagnostics');
  fs.mkdirSync(diagnosticsDir, { recursive: true });

  const stamp = safeIso(now).replace(/[:.]/g, '-');
  const outputPath = path.join(diagnosticsDir, `diagnostic-bundle-${stamp}.json`);
  const logFiles = collectLogFiles(input.logPath);

  const bundle = {
    app: {
      app_version: input.appVersion,
      generated_at: safeIso(now),
      process_pid: process.pid,
    },
    config: summarizeConfig(input.config),
    logs: {
      files: logFiles,
      total_files: logFiles.length,
    },
    runtime: {
      arch: process.arch,
      cpus: os.cpus().length,
      memory_total_bytes: os.totalmem(),
      node_version: process.version,
      platform: process.platform,
      release: os.release(),
      uptime_seconds: process.uptime(),
      user_home: os.homedir(),
      versions: process.versions,
    },
  };

  fs.writeFileSync(outputPath, JSON.stringify(bundle, null, 2), 'utf8');
  return outputPath;
}
