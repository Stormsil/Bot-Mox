import { useState, useCallback, useRef } from 'react';
import type { ProxmoxVM, VMQueueItem, VMUiState } from '../../types';
import type { AddDeleteTaskOverrides, AddToQueueOverrides, UseVMQueueParams } from './queue/types';
import { processVmQueue } from './queue/processor';
import { generateNextVmName, normalizeVmId } from './queue/utils';
export function useVMQueue({ log, usedIds, usedNames, node }: UseVMQueueParams) {
  const [queue, setQueue] = useState<VMQueueItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uiState, setUiState] = useState<VMUiState>('ready');
  const [operationText, setOperationText] = useState('');
  const [readyVmIds, setReadyVmIds] = useState<number[]>([]);
  const cancelRef = useRef(false);
  const queueRef = useRef<VMQueueItem[]>([]);

  const syncQueue = useCallback((updater: (prev: VMQueueItem[]) => VMQueueItem[]) => {
    setQueue(prev => {
      const next = updater(prev);
      queueRef.current = next;
      return next;
    });
  }, []);

  const addToQueue = useCallback((overrides?: AddToQueueOverrides) => {
    const prefix = overrides?.prefix || 'WoW';
    const queueNames = queueRef.current.map(i => i.name);
    const generated = generateNextVmName(prefix, usedIds, usedNames, queueNames);
    const name = String(overrides?.name || '').trim() || generated.name;

    const newItem: VMQueueItem = {
      id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name,
      storage: overrides?.storage || 'data',
      format: overrides?.format || 'raw',
      resourceMode: overrides?.resourceMode || 'project',
      cores: overrides?.cores,
      memory: overrides?.memory,
      projectId: overrides?.projectId || 'wow_tbc',
      status: 'pending',
    };
    syncQueue(prev => [...prev, newItem]);
    return newItem;
  }, [usedIds, usedNames, syncQueue]);

  const addDeleteToQueue = useCallback((overrides: AddDeleteTaskOverrides) => {
    const vmid = normalizeVmId(overrides.vmid);
    if (!vmid) return null;

    const rawName = String(overrides.name || '').trim();
    const name = rawName || `VM ${vmid}`;
    const existingDeleteTask = queueRef.current.some(item =>
      (item.action || 'create') === 'delete' && normalizeVmId(item.targetVmId ?? item.vmId) === vmid
    );
    if (existingDeleteTask) return null;

    const newItem: VMQueueItem = {
      id: `q_del_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      action: 'delete',
      name,
      storage: '',
      format: '',
      resourceMode: 'project',
      cores: undefined,
      memory: undefined,
      projectId: overrides.projectId || 'wow_tbc',
      status: 'pending',
      targetVmId: vmid,
      vmId: vmid,
    };
    syncQueue(prev => [...prev, newItem]);
    return newItem;
  }, [syncQueue]);

  const addDeleteTasks = useCallback((vms: Array<Pick<ProxmoxVM, 'vmid' | 'name'>>): number => {
    let added = 0;
    for (const vm of vms) {
      const created = addDeleteToQueue({
        vmid: vm.vmid,
        name: vm.name || `VM ${vm.vmid}`,
      });
      if (created) added += 1;
    }
    return added;
  }, [addDeleteToQueue]);

  const removeFromQueue = useCallback((id: string) => {
    syncQueue(prev => prev.filter(item => item.id !== id));
  }, [syncQueue]);

  const clearQueue = useCallback(() => {
    syncQueue(() => []);
    setReadyVmIds([]);
  }, [syncQueue]);

  const updateQueueItem = useCallback((id: string, updates: Partial<VMQueueItem>) => {
    syncQueue(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  }, [syncQueue]);

  const cancelProcessing = useCallback(() => {
    cancelRef.current = true;
    setOperationText('Cancelling...');
  }, []);

  /**
   * Two-phase processing.
   * Phase 1: clone all pending items.
   * Phase 2: patch config + apply only cores/memory + Firebase.
   */
  const processQueue = useCallback(async () => {
    await processVmQueue({
      log,
      usedIds,
      node,
      queueRef,
      cancelRef,
      setIsProcessing,
      setUiState,
      setOperationText,
      setReadyVmIds,
      updateQueueItem,
    });
  }, [log, usedIds, node, updateQueueItem]);

  return {
    queue,
    isProcessing,
    uiState,
    operationText,
    readyVmIds,
    addToQueue,
    addDeleteToQueue,
    addDeleteTasks,
    removeFromQueue,
    clearQueue,
    updateQueueItem,
    processQueue,
    cancelProcessing,
  };
}

