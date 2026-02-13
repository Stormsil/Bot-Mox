import { AgentConfig } from '../core/config-store';
import { Logger } from '../core/logger';
import { executeProxmox } from './proxmox';

// ---------------------------------------------------------------------------
// Command executor router
// ---------------------------------------------------------------------------

export async function executeCommand(
  commandType: string,
  payload: Record<string, unknown>,
  config: AgentConfig,
  logger: Logger,
): Promise<unknown> {
  if (commandType.startsWith('proxmox.')) {
    return executeProxmox(commandType, payload, config.proxmox, logger);
  }

  // Future: syncthing, ssh, etc.
  throw new Error(`Unknown command type: ${commandType}`);
}
