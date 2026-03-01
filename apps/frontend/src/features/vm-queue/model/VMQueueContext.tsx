import { createContext, useContext, useSyncExternalStore } from 'react';
import type { Playbook } from '../../../entities/vm/api/playbookFacade';
import type { UnattendProfile } from '../../../entities/vm/api/unattendProfileFacade';
import type { VMQueueItem, VMStorageOption } from '../../../entities/vm/model/types';

type VMProjectId = 'wow_tbc' | 'wow_midnight';

interface QueueResourcePreset {
  label: string;
  cores: number;
  memoryMb: number;
  diskGiB: number;
}

type VMQueueProjectOption = { value: VMProjectId; label: string };

const noop = () => undefined;

export interface VMQueuePanelBridgeValue {
  isProcessing: boolean;
  isStartActionRunning: boolean;
  canStartAll: boolean;
  startingItemId: string | null;
  storageOptions: VMStorageOption[];
  projectOptions: VMQueueProjectOption[];
  resourcePresets: Record<VMProjectId, QueueResourcePreset>;
  onAdd: () => void;
  onAddDelete?: () => void;
  onClear: () => void;
  onStartAll?: () => void;
  onStartOne?: (id: string) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<VMQueueItem>) => void;
}

const DEFAULT_VM_QUEUE_PANEL_BRIDGE_VALUE: VMQueuePanelBridgeValue = {
  isProcessing: false,
  isStartActionRunning: false,
  canStartAll: false,
  startingItemId: null,
  storageOptions: [],
  projectOptions: [],
  resourcePresets: {
    wow_tbc: { label: 'WoW TBC', cores: 2, memoryMb: 4096, diskGiB: 128 },
    wow_midnight: { label: 'WoW Midnight', cores: 2, memoryMb: 4096, diskGiB: 128 },
  },
  onAdd: noop,
  onAddDelete: undefined,
  onClear: noop,
  onStartAll: undefined,
  onStartOne: undefined,
  onRemove: noop,
  onUpdate: noop,
};

let vmQueuePanelBridgeValue = DEFAULT_VM_QUEUE_PANEL_BRIDGE_VALUE;
const vmQueuePanelBridgeListeners = new Set<() => void>();

function subscribeVmQueuePanelBridge(listener: () => void) {
  vmQueuePanelBridgeListeners.add(listener);
  return () => vmQueuePanelBridgeListeners.delete(listener);
}

function emitVmQueuePanelBridgeChange() {
  vmQueuePanelBridgeListeners.forEach((listener) => {
    listener();
  });
}

export function setVMQueuePanelBridgeValue(value: VMQueuePanelBridgeValue): void {
  vmQueuePanelBridgeValue = value;
  emitVmQueuePanelBridgeChange();
}

export function resetVMQueuePanelBridgeValue(): void {
  vmQueuePanelBridgeValue = DEFAULT_VM_QUEUE_PANEL_BRIDGE_VALUE;
  emitVmQueuePanelBridgeChange();
}

export function useVMQueuePanelBridgeValue(): VMQueuePanelBridgeValue {
  return useSyncExternalStore(
    subscribeVmQueuePanelBridge,
    () => vmQueuePanelBridgeValue,
    () => vmQueuePanelBridgeValue,
  );
}

export interface VMQueueContextValue {
  queue: VMQueueItem[];
  isProcessing: boolean;
  isStartActionRunning: boolean;
  startingItemId: string | null;
  storageOptions: VMStorageOption[];
  projectOptionById: Map<VMProjectId, { value: VMProjectId; label: string }>;
  resourcePresets: Record<VMProjectId, QueueResourcePreset>;
  unattendProfileById: Map<string, UnattendProfile>;
  defaultUnattendProfile: UnattendProfile | null;
  playbookList: Playbook[];
  defaultPlaybook: Playbook | null;
  unattendProfilesLoading: boolean;
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<VMQueueItem>) => void;
  onStartOne?: (id: string) => void;
  openCustomEditor: (item: VMQueueItem) => void;
  openUnattendEditor: (item: VMQueueItem) => void;
  className: (classNames: string) => string;
}

const VMQueueContext = createContext<VMQueueContextValue | null>(null);

export const VMQueueContextProvider = VMQueueContext.Provider;

export function useVMQueueContext(): VMQueueContextValue {
  const context = useContext(VMQueueContext);
  if (!context) {
    throw new Error('useVMQueueContext must be used within VMQueueContextProvider');
  }
  return context;
}
