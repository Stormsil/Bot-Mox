import { ApiClient, ApiError } from '../../core/api-client';
import type { AgentConfig, ConfigStore } from '../../core/config-store';
import type { Logger } from '../../core/logger';
import { executeProxmox } from '../../executors/proxmox';
import {
  buildPairedConfig,
  buildProxmoxTargetId,
  getProxmoxTargetsFromConfig,
  normalizeTargetConfig,
} from './proxmox-targets';
import { buildDefaultAgentName, buildMachineName, resolveServerUrl } from './utils';

export interface QuickPairData {
  serverUrl: string;
  login: string;
  password: string;
  targetId?: string;
  proxmoxUrl: string;
  proxmoxUsername: string;
  proxmoxPassword?: string;
  proxmoxNode: string;
}

export interface ProxmoxProbeData {
  targetId?: string;
  proxmoxUrl: string;
  proxmoxUsername: string;
  proxmoxPassword?: string;
  proxmoxNode: string;
}

interface AgentRegistrationResult {
  id: string;
  name: string;
  status: string;
  paired_at: string;
  agent_token: string;
  agent_token_expires_at?: string;
}

interface HandlerDeps {
  configStore: ConfigStore;
  logger: Logger;
  closeWindow: () => void;
  onComplete: ((config: AgentConfig) => void) | null;
}

export async function handleQuickPair(
  data: QuickPairData,
  deps: HandlerDeps,
): Promise<{ success: boolean; error?: string }> {
  try {
    const current = deps.configStore.get();
    const resolvedServerUrl = await resolveServerUrl(
      [
        data.serverUrl,
        String(current.serverUrl || ''),
        process.env.BOTMOX_SERVER_URL || '',
        // Auto-detect for local dev convenience:
        'http://localhost',
        'http://localhost:3002',
        'http://127.0.0.1',
        'http://127.0.0.1:3002',
      ],
      deps.logger,
    );
    const login = String(data.login || '').trim();
    const password = String(data.password || '');
    const selectedTargetId = String(data.targetId || '').trim();
    const targets = getProxmoxTargetsFromConfig(current);
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

    deps.logger.info(`Quick pairing to ${resolvedServerUrl} using Bot-Mox account credentials`);

    const client = new ApiClient(resolvedServerUrl, '', deps.logger);
    const result = await client.post<AgentRegistrationResult>('/api/v1/agents/quick-pair', {
      login,
      password,
      machine_name: buildMachineName(),
      name: buildMachineName(),
      version: '0.1.0',
      platform: process.platform,
      capabilities: ['proxmox'],
    });

    if (!result.agent_token) {
      throw new Error('Quick-pair response did not include agent auth token');
    }

    const proxmoxTarget = normalizeTargetConfig({
      url: data.proxmoxUrl,
      username: data.proxmoxUsername,
      password: proxmoxPassword,
      node: data.proxmoxNode,
    });

    const config = buildPairedConfig(
      resolvedServerUrl,
      result,
      proxmoxTarget,
      targets,
      buildMachineName(),
      buildDefaultAgentName(),
    );
    deps.configStore.save(config);
    deps.logger.info(`Quick-paired successfully as agent ${result.id}`);

    deps.closeWindow();
    deps.onComplete?.(config);

    return { success: true };
  } catch (err) {
    const message =
      err instanceof ApiError
        ? `${err.code}: ${err.message}`
        : err instanceof Error
          ? err.message
          : String(err);
    deps.logger.error(`Quick-pair failed: ${message}`);
    return { success: false, error: message };
  }
}

export async function handleTestProxmox(
  data: ProxmoxProbeData,
  deps: HandlerDeps,
): Promise<{ success: boolean; error?: string }> {
  try {
    const current = deps.configStore.get();
    const selectedTargetId = String(data.targetId || '').trim();
    const targets = getProxmoxTargetsFromConfig(current);
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
      deps.logger,
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
      deps.logger,
    );

    const testedTarget = normalizeTargetConfig({
      url: proxmoxUrl,
      username: proxmoxUsername,
      password: proxmoxPassword,
      node: proxmoxNode,
    });
    const nextTargetId =
      selectedTargetId && targets[selectedTargetId]
        ? selectedTargetId
        : buildProxmoxTargetId(testedTarget.url, testedTarget.username, testedTarget.node);
    const mergedTargets = {
      ...targets,
      [nextTargetId]: testedTarget,
    };

    deps.configStore.save({
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

export async function handleSaveProxmoxTarget(
  data: ProxmoxProbeData,
  deps: HandlerDeps,
): Promise<{ success: boolean; error?: string; targetId?: string }> {
  try {
    const current = deps.configStore.get();
    const selectedTargetId = String(data.targetId || '').trim();
    const targets = getProxmoxTargetsFromConfig(current);
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

    const targetConfig = normalizeTargetConfig({
      url: proxmoxUrl,
      username: proxmoxUsername,
      password: proxmoxPassword,
      node: proxmoxNode,
    });
    const nextTargetId =
      selectedTargetId && targets[selectedTargetId]
        ? selectedTargetId
        : buildProxmoxTargetId(targetConfig.url, targetConfig.username, targetConfig.node);
    const mergedTargets = {
      ...targets,
      [nextTargetId]: targetConfig,
    };

    deps.configStore.save({
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
