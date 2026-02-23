import { createContext, useContext } from 'react';
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
