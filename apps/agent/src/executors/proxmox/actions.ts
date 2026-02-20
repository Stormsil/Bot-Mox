import type { ProxmoxConfig } from '../../core/config-store';
import type { Logger } from '../../core/logger';
import {
  PROXMOX_ACTION_UNHANDLED,
  type ProxmoxActionContext,
  type ProxmoxActionHandler,
} from './context';
import { handleIsoActions } from './iso-actions';
import { handleSshActions } from './ssh-actions';
import { handleVmActions } from './vm-actions';
import { handleWaitActions } from './wait-actions';

const HANDLERS: ProxmoxActionHandler[] = [
  handleVmActions,
  handleWaitActions,
  handleSshActions,
  handleIsoActions,
];

function buildContext(
  commandType: string,
  payload: Record<string, unknown>,
  config: ProxmoxConfig,
  logger: Logger,
): ProxmoxActionContext {
  return {
    action: commandType.replace('proxmox.', ''),
    payload,
    config,
    logger,
    node: String(payload.node || config.node),
    vmid: payload.vmid ? String(payload.vmid) : undefined,
  };
}

export async function executeProxmox(
  commandType: string,
  payload: Record<string, unknown>,
  config: ProxmoxConfig,
  logger: Logger,
): Promise<unknown> {
  const context = buildContext(commandType, payload, config, logger);

  for (const handler of HANDLERS) {
    const result = await handler(context);
    if (result !== PROXMOX_ACTION_UNHANDLED) {
      return result;
    }
  }

  throw new Error(`Unknown proxmox action: ${context.action}`);
}
