import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getSelectedProxmoxTargetNode } from '../../../entities/vm/api/vmSelectionFacade';
import { getVMSettings } from '../../../entities/vm/api/vmSettingsFacade';
import { ApiClientError } from '../../../shared/api/apiClient';
import { getProxmoxConnectionSnapshot, listVMs } from '../../../shared/api/services/vm/proxmoxOps';
import { getSshConnectionStatus } from '../../../shared/api/services/vm/sshOps';
import type { ProxmoxVM } from '../../../shared/types';

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

  // Computed sets for smart VM name generation
  const usedIds = useMemo(() => new Set(vms.map((vm) => vm.vmid)), [vms]);
  const usedNames = useMemo(() => new Set(vms.map((vm) => (vm.name || '').toLowerCase())), [vms]);

  // Initial load
  useEffect(() => {
    void checkConnections();
    void refreshVMs();
  }, [checkConnections, refreshVMs]);

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
