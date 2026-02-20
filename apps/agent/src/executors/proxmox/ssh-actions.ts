import { executeSshCommand } from '../ssh';
import {
  PROXMOX_ACTION_UNHANDLED,
  type ProxmoxActionContext,
  type ProxmoxActionResult,
} from './context';
import { probeSshStatus } from './ssh-helpers';
import { buildVmConfigWriteCommand, normalizeVmId } from './utils';

export async function handleSshActions(
  context: ProxmoxActionContext,
): Promise<ProxmoxActionResult> {
  const { action, payload, config, logger } = context;

  if (action === 'ssh-status' || action === 'ssh-test') {
    return probeSshStatus(payload, config, logger);
  }

  if (action === 'ssh-bootstrap') {
    const status = await probeSshStatus(payload, config, logger);
    return {
      ...status,
      bootstrap: 'validated',
    };
  }

  if (action === 'ssh-read-config') {
    const vmidRaw = payload.vmid ?? payload.id;
    const normalizedVmid = normalizeVmId(vmidRaw);
    const command = `cat /etc/pve/qemu-server/${normalizedVmid}.conf`;
    const result = await executeSshCommand({
      command,
      payload,
      proxmoxConfig: config,
      logger,
      timeoutMs: payload.timeoutMs ?? payload.timeout_ms ?? 15_000,
      enforceAllowlist: true,
    });
    if (result.exitCode !== 0) {
      throw new Error(
        `SSH_READ_FAILED: ${result.stderr || `Failed to read VM config for ${normalizedVmid}`}`,
      );
    }
    return { config: result.stdout };
  }

  if (action === 'ssh-write-config') {
    const vmidRaw = payload.vmid ?? payload.id;
    const normalizedVmid = normalizeVmId(vmidRaw);
    const content = String(payload.content || '');
    const command = buildVmConfigWriteCommand(normalizedVmid, content);
    const result = await executeSshCommand({
      command,
      payload,
      proxmoxConfig: config,
      logger,
      timeoutMs: payload.timeoutMs ?? payload.timeout_ms ?? 20_000,
      enforceAllowlist: false,
    });
    if (result.exitCode !== 0) {
      throw new Error(
        `SSH_WRITE_FAILED: ${result.stderr || `Failed to write VM config for ${normalizedVmid}`}`,
      );
    }
    return { written: true };
  }

  if (action === 'ssh-exec') {
    const command = String(payload.command || '').trim();
    const result = await executeSshCommand({
      command,
      payload,
      proxmoxConfig: config,
      logger,
      timeoutMs: payload.timeoutMs ?? payload.timeout ?? payload.timeout_ms ?? 30_000,
      enforceAllowlist: true,
      allowUnsafe: Boolean(payload.allowUnsafe),
    });
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      allowlisted: true,
    };
  }

  return PROXMOX_ACTION_UNHANDLED;
}
