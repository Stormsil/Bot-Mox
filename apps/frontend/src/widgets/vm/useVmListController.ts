import { message } from 'antd';
import { useCallback, useMemo, useState } from 'react';
import {
  useStartVmMutation,
  useStopVmMutation,
  useUpdateVmConfigMutation,
  useWaitForVmTaskMutation,
} from '../../entities/vm/api/useVmActionMutations';
import type { ProxmoxVM } from '../../types';

interface UseVmListControllerArgs {
  vms: ProxmoxVM[];
  node: string;
  refreshVMs: () => Promise<void> | void;
}

export function useVmListController({ vms, node, refreshVMs }: UseVmListControllerArgs) {
  const startVmMutation = useStartVmMutation();
  const stopVmMutation = useStopVmMutation();
  const updateVmConfigMutation = useUpdateVmConfigMutation();
  const waitForVmTaskMutation = useWaitForVmTaskMutation();
  const [renameTarget, setRenameTarget] = useState<ProxmoxVM | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);

  const handleStart = useCallback(
    async (vmid: number) => {
      try {
        await startVmMutation.mutateAsync({ vmid, node });
        message.success(`VM ${vmid} start requested`);
        void refreshVMs();
      } catch (err) {
        message.error(`Failed to start VM ${vmid}: ${(err as Error).message}`);
      }
    },
    [node, refreshVMs, startVmMutation],
  );

  const handleStop = useCallback(
    async (vmid: number) => {
      try {
        await stopVmMutation.mutateAsync({ vmid, node });
        message.success(`VM ${vmid} stop requested`);
        void refreshVMs();
      } catch (err) {
        message.error(`Failed to stop VM ${vmid}: ${(err as Error).message}`);
      }
    },
    [node, refreshVMs, stopVmMutation],
  );

  const openRenameModal = useCallback((vm: ProxmoxVM) => {
    setRenameTarget(vm);
    setRenameValue(String(vm.name || `VM ${vm.vmid}`));
  }, []);

  const closeRenameModal = useCallback(() => {
    setRenameTarget(null);
    setRenameValue('');
  }, []);

  const handleRenameSubmit = useCallback(async () => {
    if (!renameTarget) return;

    const nextName = String(renameValue || '').trim();
    if (!nextName) {
      message.warning('VM name is required');
      return;
    }

    setRenameSaving(true);
    try {
      const result = await updateVmConfigMutation.mutateAsync({
        vmid: renameTarget.vmid,
        node,
        config: { name: nextName },
      });

      if (result.upid) {
        const status = await waitForVmTaskMutation.mutateAsync({
          upid: result.upid,
          node,
          options: { timeoutMs: 90_000, intervalMs: 1_000 },
        });
        if (status.exitstatus && status.exitstatus !== 'OK') {
          throw new Error(status.exitstatus);
        }
      }

      message.success(`VM ${renameTarget.vmid} renamed to ${nextName}`);
      closeRenameModal();
      void refreshVMs();
    } catch (err) {
      message.error(`Rename failed: ${(err as Error).message}`);
    } finally {
      setRenameSaving(false);
    }
  }, [
    closeRenameModal,
    node,
    refreshVMs,
    renameTarget,
    renameValue,
    updateVmConfigMutation,
    waitForVmTaskMutation,
  ]);

  const runningCount = useMemo(() => vms.filter((vm) => vm.status === 'running').length, [vms]);
  const stoppedCount = useMemo(() => vms.filter((vm) => vm.status === 'stopped').length, [vms]);

  return {
    runningCount,
    stoppedCount,
    handleStart,
    handleStop,
    openRenameModal,
    renameTarget,
    renameValue,
    setRenameValue,
    renameSaving,
    closeRenameModal,
    handleRenameSubmit,
  };
}
