import { AgentConfig, ProxmoxConfig, ProxmoxTargetConfig } from '../core/config-store';
import { Logger } from '../core/logger';
import { executeProxmox } from './proxmox';
import { resolveSshConfig } from './ssh';

// ---------------------------------------------------------------------------
// Command executor router
// ---------------------------------------------------------------------------

function getProxmoxTargets(config: AgentConfig): Record<string, ProxmoxTargetConfig> {
  const fromConfig = config.proxmoxTargets && typeof config.proxmoxTargets === 'object'
    ? config.proxmoxTargets
    : {};
  return fromConfig;
}

function resolveProxmoxConfig(
  payload: Record<string, unknown>,
  config: AgentConfig,
): ProxmoxConfig {
  const targets = getProxmoxTargets(config);
  const requestedTargetId = String(payload.target || '').trim();
  const activeTargetId = String(config.activeProxmoxTargetId || '').trim();

  if (requestedTargetId) {
    const target = targets[requestedTargetId];
    if (!target) {
      throw new Error(`Unknown Proxmox target: ${requestedTargetId}`);
    }
    return target;
  }

  if (activeTargetId && targets[activeTargetId]) {
    return targets[activeTargetId];
  }

  if (config.proxmox) {
    return config.proxmox;
  }

  const firstTarget = Object.values(targets)[0];
  if (firstTarget) {
    return firstTarget;
  }

  throw new Error('No Proxmox configuration found');
}

function listProxmoxTargets(config: AgentConfig): Array<{
  id: string;
  label: string;
  url: string;
  username: string;
  node: string;
  isActive: boolean;
  sshConfigured: boolean;
}> {
  const targets = getProxmoxTargets(config);
  const activeTargetId = String(config.activeProxmoxTargetId || '').trim();

  const records = Object.entries(targets).map(([id, target]) => {
    const url = String(target.url || '').trim();
    const username = String(target.username || '').trim();
    const node = String(target.node || '').trim() || 'h1';
    const fallbackLabel = `${url.replace(/^https?:\/\//, '')} · ${node} · ${username || 'user'}`;
    const sshConfig = resolveSshConfig({}, target);
    return {
      id,
      label: String(target.label || '').trim() || fallbackLabel,
      url,
      username,
      node,
      isActive: id === activeTargetId,
      sshConfigured: sshConfig.configured,
    };
  });

  records.sort((first, second) => {
    if (first.isActive) return -1;
    if (second.isActive) return 1;
    return first.label.localeCompare(second.label);
  });

  if (records.length > 0) {
    return records;
  }

  if (!config.proxmox) {
    return [];
  }

  return [{
    id: 'legacy',
    label: String(config.proxmox.url || '').replace(/^https?:\/\//, '') || 'legacy',
    url: config.proxmox.url,
    username: config.proxmox.username,
    node: config.proxmox.node,
    isActive: true,
    sshConfigured: resolveSshConfig({}, config.proxmox).configured,
  }];
}

export async function executeCommand(
  commandType: string,
  payload: Record<string, unknown>,
  config: AgentConfig,
  logger: Logger,
): Promise<unknown> {
  if (commandType === 'proxmox.list-targets') {
    return listProxmoxTargets(config);
  }

  if (commandType.startsWith('proxmox.')) {
    const proxmoxConfig = resolveProxmoxConfig(payload, config);
    return executeProxmox(commandType, payload, proxmoxConfig, logger);
  }

  // Future: syncthing, ssh, etc.
  throw new Error(`Unknown command type: ${commandType}`);
}
