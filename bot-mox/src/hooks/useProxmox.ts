import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { ProxmoxVM } from '../types';
import { listVMs, testProxmoxConnection, testSSHConnection } from '../services/vmService';
import { getVMSettings } from '../services/vmSettingsService';

const REFRESH_INTERVAL = 5000; // 5 seconds (WPF parity)

export function useProxmox() {
  const [connected, setConnected] = useState(false);
  const [sshConnected, setSshConnected] = useState(false);
  const [vms, setVms] = useState<ProxmoxVM[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [node, setNode] = useState('h1');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkConnections = useCallback(async () => {
    const [proxmoxOk, sshOk] = await Promise.all([
      testProxmoxConnection(),
      testSSHConnection(),
    ]);
    setConnected(proxmoxOk);
    setSshConnected(sshOk);
    return proxmoxOk;
  }, []);

  const refreshVMs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const settings = await getVMSettings();
      const targetNode = settings.proxmox?.node || 'h1';
      setNode(targetNode);
      const vmList = await listVMs(targetNode);
      setVms(vmList);
      setConnected(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to refresh VMs';
      setError(msg);
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // Computed sets for smart VM name generation
  const usedIds = useMemo(() => new Set(vms.map(vm => vm.vmid)), [vms]);
  const usedNames = useMemo(() => new Set(vms.map(vm => (vm.name || '').toLowerCase())), [vms]);

  // Initial load and auto-refresh
  useEffect(() => {
    checkConnections();
    refreshVMs();

    intervalRef.current = setInterval(refreshVMs, REFRESH_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [checkConnections, refreshVMs]);

  return {
    connected,
    sshConnected,
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
