import type { ProxmoxConfig } from '../../core/config-store';
import type { Logger } from '../../core/logger';

export const PROXMOX_ACTION_UNHANDLED = Symbol('proxmox-action-unhandled');

export interface ProxmoxActionContext {
  action: string;
  payload: Record<string, unknown>;
  config: ProxmoxConfig;
  logger: Logger;
  node: string;
  vmid?: string;
}

export type ProxmoxActionResult = unknown | typeof PROXMOX_ACTION_UNHANDLED;

export type ProxmoxActionHandler = (context: ProxmoxActionContext) => Promise<ProxmoxActionResult>;
