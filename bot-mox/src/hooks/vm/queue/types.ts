import type { ProxmoxVM, VMQueueItem, VMResourceMode, VMUiState } from '../../../types';
import type { VMLog } from '../../useVMLog';

export interface UseVMQueueParams {
  log: VMLog;
  usedIds: Set<number>;
  usedNames: Set<string>;
  node: string;
}

export interface AddToQueueOverrides {
  name?: string;
  storage?: string;
  format?: string;
  projectId?: 'wow_tbc' | 'wow_midnight';
  resourceMode?: VMResourceMode;
  prefix?: string;
  cores?: number;
  memory?: number;
}

export interface AddDeleteTaskOverrides {
  vmid: number;
  name: string;
  projectId?: 'wow_tbc' | 'wow_midnight';
}

export interface ProcessVmQueueContext {
  log: VMLog;
  usedIds: Set<number>;
  node: string;
  queueRef: { current: VMQueueItem[] };
  cancelRef: { current: boolean };
  setIsProcessing: (next: boolean) => void;
  setUiState: (next: VMUiState) => void;
  setOperationText: (next: string) => void;
  setReadyVmIds: (next: number[]) => void;
  updateQueueItem: (id: string, updates: Partial<VMQueueItem>) => void;
}

export type VmDeleteCandidate = Pick<ProxmoxVM, 'vmid' | 'name'>;
