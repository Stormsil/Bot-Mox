import type { ProxmoxConfig } from '../core/config-store';
import type { Logger } from '../core/logger';
import { executeProxmox as executeProxmoxAction } from './proxmox/actions';

export async function executeProxmox(
  commandType: string,
  payload: Record<string, unknown>,
  config: ProxmoxConfig,
  logger: Logger,
): Promise<unknown> {
  return executeProxmoxAction(commandType, payload, config, logger);
}
