import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiClientError } from '../services/apiClient';
import { subscribeToVmOpsEvents } from '../services/vmOpsEventsService';
import { getSelectedProxmoxTargetNode } from '../services/vmOpsService';
import {
  getProxmoxConnectionSnapshot,
  getSshConnectionStatus,
  listVMs,
} from '../services/vmService';
import { getVMSettings } from '../services/vmSettingsService';
import type { ProxmoxVM } from '../types';

const VM_MUTATION_COMMANDS = new Set([
  'proxmox.clone',
  'proxmox.delete',
  'proxmox.start',
  'proxmox.stop',
  'proxmox.update-config',
  'proxmox.ssh-write-config',
]);
const TERMINAL_COMMAND_STATUSES = new Set(['succeeded', 'failed', 'cancelled', 'expired']);
const REFRESH_DEBOUNCE_MS = 500;
const CONNECTIVITY_ERROR_CODES = new Set([
  'AGENT_OFFLINE',
  'AGENT_NOT_FOUND',
  'AGENT_OWNER_UNASSIGNED',
  'AGENT_OWNER_MISMATCH',
]);

export function useProxmox() {
  const [connected, setConnected] = useState(false);
  const [sshConnected, setSshConnected] = useState(false);
  const [sshConfigured, setSshConfigured] = useState(false);
  const [sshStatusCode, setSshStatusCode] = useState<string | null>(null);
  const [vms, setVms] = useState<ProxmoxVM[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [node, setNode] = useState('h1');
  const refreshInFlightRef = useRef(false);
  const refreshDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkConnections = useCallback(async () => {
    const [status, sshStatus] = await Promise.all([
      getProxmoxConnectionSnapshot(),
      getSshConnectionStatus({ forceRefresh: true }),
    ]);
    setConnected((previous) => (status.agentOnline ? true : previous));
    setSshConfigured(Boolean(sshStatus.configured));
    setSshConnected(status.agentOnline && Boolean(sshStatus.connected));
    setSshStatusCode(sshStatus.code || null);
    return status.agentOnline;
  }, []);

  const refreshVMs = useCallback(async () => {
    if (refreshInFlightRef.current) {
      return;
    }
    refreshInFlightRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const settings = await getVMSettings();
      const settingsNode = settings.proxmox?.node || 'h1';
      const selectedTargetNode = getSelectedProxmoxTargetNode();
      const targetNode = selectedTargetNode || settingsNode;
      setNode(targetNode);
      const vmList = await listVMs(targetNode);
      setVms(vmList);
      setConnected(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to refresh VMs';
      setError(msg);
      if (
        err instanceof ApiClientError &&
        CONNECTIVITY_ERROR_CODES.has(String(err.code || '').trim())
      ) {
        setConnected(false);
      }
    } finally {
      setLoading(false);
      refreshInFlightRef.current = false;
    }
  }, []);

  const scheduleRefreshVMs = useCallback(() => {
    if (refreshDebounceRef.current) {
      return;
    }

    refreshDebounceRef.current = setTimeout(() => {
      refreshDebounceRef.current = null;
      void refreshVMs();
    }, REFRESH_DEBOUNCE_MS);
  }, [refreshVMs]);

  // Computed sets for smart VM name generation
  const usedIds = useMemo(() => new Set(vms.map((vm) => vm.vmid)), [vms]);
  const usedNames = useMemo(() => new Set(vms.map((vm) => (vm.name || '').toLowerCase())), [vms]);

  // Initial load
  useEffect(() => {
    void checkConnections();
    void refreshVMs();

    const unsubscribe = subscribeToVmOpsEvents((event) => {
      const commandType = String(event.command?.command_type || '')
        .trim()
        .toLowerCase();
      const commandStatus = String(event.command?.status || '')
        .trim()
        .toLowerCase();
      if (!VM_MUTATION_COMMANDS.has(commandType)) {
        return;
      }
      if (!TERMINAL_COMMAND_STATUSES.has(commandStatus)) {
        return;
      }
      scheduleRefreshVMs();
    });

    return () => {
      unsubscribe();
      if (refreshDebounceRef.current) {
        clearTimeout(refreshDebounceRef.current);
        refreshDebounceRef.current = null;
      }
    };
  }, [checkConnections, refreshVMs, scheduleRefreshVMs]);

  return {
    connected,
    sshConnected,
    sshConfigured,
    sshStatusCode,
    vms,
    loading,
    error,
    node,
    usedIds,
    usedNames,
    refreshVMs,
    checkConnections,
  };
}
