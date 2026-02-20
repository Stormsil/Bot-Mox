import type { ProxmoxConfig } from '../../core/config-store';
import type { Logger } from '../../core/logger';
import { buildSshStatus, executeSshCommand, resolveSshConfig } from '../ssh';
import { parseTaggedErrorCode } from './utils';

export async function probeSshStatus(
  payload: Record<string, unknown>,
  config: ProxmoxConfig,
  logger: Logger,
): Promise<Record<string, unknown>> {
  const sshConfig = resolveSshConfig(payload, config);
  const status = buildSshStatus(sshConfig);

  if (!sshConfig.configured) {
    return {
      ...status,
      connected: false,
      code: 'SSH_REQUIRED',
      message: 'SSH credentials are not configured for this computer.',
    };
  }

  try {
    const probe = await executeSshCommand({
      command: 'echo BOTMOX_SSH_OK',
      payload,
      proxmoxConfig: config,
      logger,
      timeoutMs: payload.timeoutMs ?? payload.timeout_ms ?? 10_000,
      enforceAllowlist: false,
    });

    return {
      ...status,
      connected: Number(probe.exitCode) === 0,
      code: Number(probe.exitCode) === 0 ? 'OK' : 'SSH_EXEC_ERROR',
      stdout: probe.stdout,
      stderr: probe.stderr,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ...status,
      connected: false,
      code: parseTaggedErrorCode(message),
      message,
    };
  }
}
