import type { AgentConfig, ProxmoxTargetConfig } from '../../core/config-store';

export interface ProxmoxTargetSummary {
  id: string;
  label: string;
  url: string;
  username: string;
  node: string;
  hasPassword: boolean;
  password: string;
}

export function buildProxmoxTargetId(url: string, username: string, node: string): string {
  const normalizedUrl = String(url || '').trim();
  const normalizedUsername = String(username || '')
    .trim()
    .toLowerCase();
  const normalizedNode = String(node || '')
    .trim()
    .toLowerCase();

  let host = normalizedUrl;
  try {
    const parsed = new URL(normalizedUrl);
    host = String(parsed.host || parsed.hostname || normalizedUrl)
      .trim()
      .toLowerCase();
  } catch {
    host = normalizedUrl
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/+$/, '');
  }

  const raw = `${host}|${normalizedUsername}|${normalizedNode || 'h1'}`;
  return raw.replace(/[^a-z0-9|._:-]/g, '').replace(/\|+/g, '|');
}

export function buildProxmoxTargetLabel(
  target: Pick<ProxmoxTargetConfig, 'url' | 'username' | 'node'>,
): string {
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

export function normalizeTargetConfig(target: Partial<ProxmoxTargetConfig>): ProxmoxTargetConfig {
  const url = String(target.url || '').trim();
  const username = String(target.username || '').trim();
  const password = String(target.password || '');
  const node = String(target.node || '').trim() || 'h1';
  const label =
    String(target.label || '').trim() || buildProxmoxTargetLabel({ url, username, node });
  return { url, username, password, node, label };
}

export function getProxmoxTargetsFromConfig(
  cfg: Partial<AgentConfig>,
): Record<string, ProxmoxTargetConfig> {
  const targets: Record<string, ProxmoxTargetConfig> = {};
  const existing =
    cfg.proxmoxTargets && typeof cfg.proxmoxTargets === 'object' ? cfg.proxmoxTargets : {};

  Object.entries(existing).forEach(([id, value]) => {
    if (!value || typeof value !== 'object') return;
    const normalized = normalizeTargetConfig(value as Partial<ProxmoxTargetConfig>);
    if (!normalized.url || !normalized.username) return;
    targets[String(id)] = normalized;
  });

  if (cfg.proxmox && typeof cfg.proxmox === 'object') {
    const compatTarget = normalizeTargetConfig(cfg.proxmox as Partial<ProxmoxTargetConfig>);
    if (compatTarget.url && compatTarget.username) {
      const compatTargetId = buildProxmoxTargetId(
        compatTarget.url,
        compatTarget.username,
        compatTarget.node,
      );
      if (!targets[compatTargetId]) {
        targets[compatTargetId] = compatTarget;
      }
    }
  }

  return targets;
}

export function resolveActiveTargetId(
  cfg: Partial<AgentConfig>,
  targets: Record<string, ProxmoxTargetConfig>,
): string | null {
  const configured = String(cfg.activeProxmoxTargetId || '').trim();
  if (configured && targets[configured]) {
    return configured;
  }
  const first = Object.keys(targets)[0];
  return first || null;
}

export function toTargetSummaries(
  targets: Record<string, ProxmoxTargetConfig>,
  activeTargetId: string | null,
): ProxmoxTargetSummary[] {
  const entries = Object.entries(targets).map(([id, target]) => ({
    summary: {
      id,
      label: target.label || buildProxmoxTargetLabel(target),
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

export function buildPairedConfig(
  serverUrl: string,
  registration: {
    id: string;
    name: string;
    paired_at: string;
    agent_token: string;
  },
  proxmoxTarget: ProxmoxTargetConfig,
  targets: Record<string, ProxmoxTargetConfig>,
  machineName: string,
  defaultAgentName: string,
): AgentConfig {
  const nextTargetId = buildProxmoxTargetId(
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
    agentName: registration.name || machineName || defaultAgentName,
    proxmox: proxmoxTarget,
    proxmoxTargets: mergedTargets,
    activeProxmoxTargetId: nextTargetId,
    pairedAt: registration.paired_at || new Date().toISOString(),
    version: '0.1.0',
  };
}
