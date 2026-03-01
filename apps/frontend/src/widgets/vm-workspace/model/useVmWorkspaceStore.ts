import { create } from 'zustand';
import type { VMLogEntry, VMQueueItem, VMTaskEntry } from '../../../shared/types';

type WorkspaceStateOwner = 'zustand' | 'react-query' | 'local';

interface WorkspaceStateOwnershipEntry {
  owner: WorkspaceStateOwner;
  readFrom: string;
  writeVia: string;
}

type WorkspaceStateDomain =
  | 'layout'
  | 'queue'
  | 'logs'
  | 'targets'
  | 'vms'
  | 'settings'
  | 'shortcuts';

export const WorkspaceStateOwnership = {
  layout: {
    owner: 'zustand',
    readFrom: 'useVmWorkspaceStore(state => state.layout)',
    writeVia: 'useVmWorkspaceLayoutActions()',
  },
  queue: {
    owner: 'zustand',
    readFrom: 'useVmWorkspaceStore(state => state.queue)',
    writeVia: 'useVmWorkspaceQueueActions()',
  },
  logs: {
    owner: 'zustand',
    readFrom: 'useVmWorkspaceStore(state => state.logs)',
    writeVia: 'useVmWorkspaceLogsActions()',
  },
  targets: {
    owner: 'react-query',
    readFrom: 'vm-workspace target query hooks (TanStack Query)',
    writeVia: 'target mutation hooks + query invalidation',
  },
  vms: {
    owner: 'react-query',
    readFrom: 'vm-workspace vm query hooks (TanStack Query)',
    writeVia: 'vm mutation hooks + query invalidation',
  },
  settings: {
    owner: 'react-query',
    readFrom: 'vm-workspace settings query hooks (TanStack Query)',
    writeVia: 'settings mutation hooks + query invalidation',
  },
  shortcuts: {
    owner: 'local',
    readFrom: 'component-level keyboard shortcut handlers',
    writeVia: 'component-local state/effects',
  },
} as const satisfies Record<WorkspaceStateDomain, WorkspaceStateOwnershipEntry>;

export interface VmWorkspaceLayoutState {
  splitRatio: number;
  logHeight: number;
  isWorkspaceResizing: boolean;
  isLogResizing: boolean;
}

export interface VmWorkspaceQueueState {
  items: VMQueueItem[];
  selectedTaskKey: string | null;
  hoveredTaskKey: string | null;
}

export interface VmWorkspaceLogsState {
  activeTaskKey: string | null;
  filterText: string;
  isAutoFollowEnabled: boolean;
  entries: VMLogEntry[];
  tasks: VMTaskEntry[];
  operationApi: VmWorkspaceLogOperationApi;
}

export interface VmWorkspaceLogOperationApi {
  clear: () => void | Promise<void>;
  cancelTask: (taskId: string) => void;
  getFullLog: () => string;
}

interface VmWorkspaceLayoutActions {
  setSplitRatio: (splitRatio: number) => void;
  setLogHeight: (logHeight: number) => void;
  setWorkspaceResizing: (isWorkspaceResizing: boolean) => void;
  setLogResizing: (isLogResizing: boolean) => void;
}

interface VmWorkspaceQueueActions {
  setItems: (items: VMQueueItem[]) => void;
  setSelectedTaskKey: (selectedTaskKey: string | null) => void;
  setHoveredTaskKey: (hoveredTaskKey: string | null) => void;
  clearInteraction: () => void;
}

interface VmWorkspaceLogsActions {
  setActiveTaskKey: (activeTaskKey: string | null) => void;
  setFilterText: (filterText: string) => void;
  setAutoFollowEnabled: (isAutoFollowEnabled: boolean) => void;
  setEntries: (entries: VMLogEntry[]) => void;
  addLogEntry: (entry: VMLogEntry) => void;
  setTasks: (tasks: VMTaskEntry[]) => void;
  setOperationApi: (operationApi: VmWorkspaceLogOperationApi) => void;
  reset: () => void;
}

export interface VmWorkspaceStoreState {
  layout: VmWorkspaceLayoutState;
  queue: VmWorkspaceQueueState;
  logs: VmWorkspaceLogsState;
  layoutActions: VmWorkspaceLayoutActions;
  queueActions: VmWorkspaceQueueActions;
  logsActions: VmWorkspaceLogsActions;
}

const INITIAL_LAYOUT_STATE: VmWorkspaceLayoutState = {
  splitRatio: 0.58,
  logHeight: 280,
  isWorkspaceResizing: false,
  isLogResizing: false,
};

const INITIAL_QUEUE_STATE: VmWorkspaceQueueState = {
  items: [],
  selectedTaskKey: null,
  hoveredTaskKey: null,
};

const INITIAL_LOGS_STATE: VmWorkspaceLogsState = {
  activeTaskKey: null,
  filterText: '',
  isAutoFollowEnabled: true,
  entries: [],
  tasks: [],
  operationApi: {
    clear: () => undefined,
    cancelTask: () => undefined,
    getFullLog: () => '',
  },
};

export const useVmWorkspaceStore = create<VmWorkspaceStoreState>((set) => ({
  layout: INITIAL_LAYOUT_STATE,
  queue: INITIAL_QUEUE_STATE,
  logs: INITIAL_LOGS_STATE,
  layoutActions: {
    setSplitRatio: (splitRatio) =>
      set((state) => ({
        layout: {
          ...state.layout,
          splitRatio,
        },
      })),
    setLogHeight: (logHeight) =>
      set((state) => ({
        layout: {
          ...state.layout,
          logHeight,
        },
      })),
    setWorkspaceResizing: (isWorkspaceResizing) =>
      set((state) => ({
        layout: {
          ...state.layout,
          isWorkspaceResizing,
        },
      })),
    setLogResizing: (isLogResizing) =>
      set((state) => ({
        layout: {
          ...state.layout,
          isLogResizing,
        },
      })),
  },
  queueActions: {
    setItems: (items) =>
      set((state) => ({
        queue: {
          ...state.queue,
          items,
        },
      })),
    setSelectedTaskKey: (selectedTaskKey) =>
      set((state) => ({
        queue: {
          ...state.queue,
          selectedTaskKey,
        },
      })),
    setHoveredTaskKey: (hoveredTaskKey) =>
      set((state) => ({
        queue: {
          ...state.queue,
          hoveredTaskKey,
        },
      })),
    clearInteraction: () =>
      set((state) => ({
        queue: {
          ...state.queue,
          selectedTaskKey: null,
          hoveredTaskKey: null,
        },
      })),
  },
  logsActions: {
    setActiveTaskKey: (activeTaskKey) =>
      set((state) => ({
        logs: {
          ...state.logs,
          activeTaskKey,
        },
      })),
    setFilterText: (filterText) =>
      set((state) => ({
        logs: {
          ...state.logs,
          filterText,
        },
      })),
    setAutoFollowEnabled: (isAutoFollowEnabled) =>
      set((state) => ({
        logs: {
          ...state.logs,
          isAutoFollowEnabled,
        },
      })),
    setEntries: (entries) =>
      set((state) => ({
        logs: {
          ...state.logs,
          entries,
        },
      })),
    addLogEntry: (entry) =>
      set((state) => ({
        logs: {
          ...state.logs,
          entries: [...state.logs.entries, entry],
        },
      })),
    setTasks: (tasks) =>
      set((state) => ({
        logs: {
          ...state.logs,
          tasks,
        },
      })),
    setOperationApi: (operationApi) =>
      set((state) => ({
        logs: {
          ...state.logs,
          operationApi,
        },
      })),
    reset: () =>
      set((state) => ({
        logs: {
          ...state.logs,
          ...INITIAL_LOGS_STATE,
        },
      })),
  },
}));

const VmWorkspaceStoreSelectors = {
  splitRatio: (state: VmWorkspaceStoreState) => state.layout.splitRatio,
  logHeight: (state: VmWorkspaceStoreState) => state.layout.logHeight,
  isWorkspaceResizing: (state: VmWorkspaceStoreState) => state.layout.isWorkspaceResizing,
  isLogResizing: (state: VmWorkspaceStoreState) => state.layout.isLogResizing,
  layoutActions: (state: VmWorkspaceStoreState) => state.layoutActions,
  queueItems: (state: VmWorkspaceStoreState) => state.queue.items,
  selectedTaskKey: (state: VmWorkspaceStoreState) => state.queue.selectedTaskKey,
  hoveredTaskKey: (state: VmWorkspaceStoreState) => state.queue.hoveredTaskKey,
  queueActions: (state: VmWorkspaceStoreState) => state.queueActions,
  activeLogTaskKey: (state: VmWorkspaceStoreState) => state.logs.activeTaskKey,
  logFilterText: (state: VmWorkspaceStoreState) => state.logs.filterText,
  isAutoFollowEnabled: (state: VmWorkspaceStoreState) => state.logs.isAutoFollowEnabled,
  logTasks: (state: VmWorkspaceStoreState) => state.logs.tasks,
  logOperationApi: (state: VmWorkspaceStoreState) => state.logs.operationApi,
  logsActions: (state: VmWorkspaceStoreState) => state.logsActions,
} as const;

export const useVmWorkspaceSplitRatio = () =>
  useVmWorkspaceStore(VmWorkspaceStoreSelectors.splitRatio);
export const useVmWorkspaceLogHeight = () =>
  useVmWorkspaceStore(VmWorkspaceStoreSelectors.logHeight);
export const useVmWorkspaceIsWorkspaceResizing = () =>
  useVmWorkspaceStore(VmWorkspaceStoreSelectors.isWorkspaceResizing);
export const useVmWorkspaceIsLogResizing = () =>
  useVmWorkspaceStore(VmWorkspaceStoreSelectors.isLogResizing);
export const useVmWorkspaceLayoutActions = () =>
  useVmWorkspaceStore(VmWorkspaceStoreSelectors.layoutActions);

export const useVmWorkspaceQueueItems = () =>
  useVmWorkspaceStore(VmWorkspaceStoreSelectors.queueItems);
export const useVmWorkspaceSelectedTaskKey = () =>
  useVmWorkspaceStore(VmWorkspaceStoreSelectors.selectedTaskKey);
export const useVmWorkspaceHoveredTaskKey = () =>
  useVmWorkspaceStore(VmWorkspaceStoreSelectors.hoveredTaskKey);
export const useVmWorkspaceQueueActions = () =>
  useVmWorkspaceStore(VmWorkspaceStoreSelectors.queueActions);

export const useVmWorkspaceActiveLogTaskKey = () =>
  useVmWorkspaceStore(VmWorkspaceStoreSelectors.activeLogTaskKey);
export const useVmWorkspaceLogFilterText = () =>
  useVmWorkspaceStore(VmWorkspaceStoreSelectors.logFilterText);
export const useVmWorkspaceIsAutoFollowEnabled = () =>
  useVmWorkspaceStore(VmWorkspaceStoreSelectors.isAutoFollowEnabled);
export const useVmWorkspaceLogTasks = () => useVmWorkspaceStore(VmWorkspaceStoreSelectors.logTasks);
export const useVmWorkspaceLogOperationApi = () =>
  useVmWorkspaceStore(VmWorkspaceStoreSelectors.logOperationApi);
export const useVmWorkspaceLogsActions = () =>
  useVmWorkspaceStore(VmWorkspaceStoreSelectors.logsActions);
