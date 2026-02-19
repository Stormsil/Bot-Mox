import type { VMHardwareConfig } from '../../../types';

export const DEFAULT_HARDWARE: VMHardwareConfig = {
  cores: 2,
  sockets: 1,
  memory: 4096,
  balloon: 0,
  cpu: 'host',
  onboot: false,
  agent: false,
};

export const MUTABLE_PROXMOX_CONFIG_KEY = /^(args|net\d+|sata\d+)$/i;
export const TASK_CONFIG_DIFF_FIELDS = [
  'name',
  'cores',
  'memory',
  'net0',
  'sata0',
  'args',
  'smbios1',
] as const;
