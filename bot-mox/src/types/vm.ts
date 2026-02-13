// ============================================
// VM Generator Types
// ============================================

export interface ProxmoxVM {
  vmid: number;
  name: string;
  status: 'running' | 'stopped' | 'paused' | string;
  cpu: number;
  mem: number;
  maxmem: number;
  maxdisk: number;
  disk: number;
  uptime: number;
  netin: number;
  netout: number;
  template?: boolean;
}

export type VMQueueItemStatus = 'pending' | 'cloning' | 'cloned' | 'configuring' | 'deleting' | 'done' | 'error';
export type VMQueueItemAction = 'create' | 'delete';
export type VMResourceMode = 'original' | 'project';

export interface VMHardwareConfig {
  cores: number;
  sockets: number;
  memory: number;
  balloon: number;
  cpu: string;
  onboot: boolean;
  agent: boolean;
}

export interface VMProjectHardwareConfig {
  cores: number;
  memory: number;
}

export interface VMHardwareApplyOptions {
  applyCpu: boolean;
  applyOnboot: boolean;
  applyAgent: boolean;
}

export type VMConfigMode = 'manual' | 'profile';

export interface VMConfigProfile {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
  hardware: VMHardwareConfig;
}

export interface VMQueueItem {
  id: string;
  action?: VMQueueItemAction;
  name: string;
  storage: string;
  format: string;
  resourceMode?: VMResourceMode;
  cores?: number;
  sockets?: number;
  memory?: number;
  balloon?: number;
  projectId: 'wow_tbc' | 'wow_midnight';
  status: VMQueueItemStatus;
  vmId?: number;
  targetVmId?: number;
  ip?: string;
  uuid?: string;
  error?: string;
}

export interface ProxmoxClusterResource {
  id?: string;
  type: string;
  node?: string;
  storage?: string;
  disk?: number;
  maxdisk?: number;
  [key: string]: string | number | boolean | null | undefined;
}

export interface VMStorageOption {
  value: string;
  label: string;
  details?: string;
}

export interface CloneParams {
  templateVmId: number;
  newid?: number;
  name: string;
  storage: string;
  format: string;
  full: boolean;
  node?: string;
}

export interface VMConfigUpdateParams extends Partial<VMHardwareConfig> {
  vmid: number;
  node?: string;
  config?: Record<string, string | number | boolean | undefined>;
}

export interface ProxmoxVMConfig {
  [key: string]: string | number | boolean | null | undefined;
}

export interface CloneResult {
  upid: string;
  vmId?: number;
}

export interface ProxmoxTaskStatus {
  status: 'running' | 'stopped' | string;
  exitstatus?: string;
  type: string;
  id: string;
  node: string;
  pid: number;
  starttime: number;
  upid: string;
}

export interface SSHResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export type VMOperationLogLevel = 'info' | 'warn' | 'error' | 'debug' | 'step';

export interface VMOperationLog {
  id: string;
  timestamp: number;
  level: VMOperationLogLevel;
  message: string;
  vmName?: string;
}

export interface VMLogTable {
  id: string;
  timestamp: number;
  level: 'table';
  title: string;
  rows: Array<{ field: string; value: string }>;
  vmName?: string;
}

export interface VMLogDiff {
  id: string;
  timestamp: number;
  level: 'diff';
  title: string;
  changes: Array<{ field: string; oldValue: string; newValue: string }>;
  vmName?: string;
}

export type VMLogEntry = VMOperationLog | VMLogTable | VMLogDiff;

export type VMTaskStatus = 'running' | 'ok' | 'error' | 'cancelled';

export type VMTaskDetailLevel = 'info' | 'warn' | 'error';

export interface VMTaskDetailEntry {
  id: string;
  timestamp: number;
  level: VMTaskDetailLevel;
  message: string;
}

export interface VMTaskEntry {
  id: string;
  key: string;
  description: string;
  node: string;
  userName: string;
  startedAt: number;
  finishedAt?: number;
  status: VMTaskStatus;
  vmName?: string;
  details: VMTaskDetailEntry[];
}

export type VMUiState = 'ready' | 'working' | 'success' | 'error';


export interface VMGeneratorSettings {
  proxmox: {
    url: string;
    username: string;
    /** @deprecated Use secret binding instead. */
    password?: string;
    node: string;
  };
  ssh: {
    host: string;
    port: number;
    username: string;
    /** @deprecated Use secret binding instead. */
    password?: string;
    privateKeyPath?: string;
    useKeyAuth: boolean;
  };
  storage: {
    options: string[];
    default: string;
  };
  format: {
    options: string[];
    default: string;
  };
  template: {
    vmId: number;
    name: string;
  };
  hardware: VMHardwareConfig;
  projectHardware: {
    wow_tbc: VMProjectHardwareConfig;
    wow_midnight: VMProjectHardwareConfig;
  };
  hardwareApply: VMHardwareApplyOptions;
  services: {
    proxmoxUrl: string;
    tinyFmUrl: string;
    syncThingUrl: string;
    proxmoxAutoLogin: boolean;
    tinyFmAutoLogin: boolean;
    tinyFmUsername: string;
    /** @deprecated Use secret binding instead. */
    tinyFmPassword?: string;
    syncThingAutoLogin: boolean;
    syncThingUsername: string;
    /** @deprecated Use secret binding instead. */
    syncThingPassword?: string;
  };
  deleteVmFilters?: {
    policy: {
      allowBanned: boolean;
      allowPrepareNoResources: boolean;
      allowOrphan: boolean;
    };
    view: {
      showAllowed: boolean;
      showLocked: boolean;
      showRunning: boolean;
      showStopped: boolean;
    };
  };
}
