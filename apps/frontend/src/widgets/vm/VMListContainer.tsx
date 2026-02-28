import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useProxmox } from '../../features/vm-management/model/useProxmox';
import type { ProxmoxVM } from '../../shared/types';
import { useVmListController } from './useVmListController';
import { VMListView } from './VMListView';
import { buildVmListColumns } from './vmListColumns';

export interface VMListContainerProps {
  onRecreate?: (vm: ProxmoxVM) => void;
}

export const VMListContainer: React.FC<VMListContainerProps> = ({ onRecreate }) => {
  const proxmox = useProxmox();
  const [tableHeight, setTableHeight] = useState(() =>
    typeof window === 'undefined' ? 520 : Math.max(260, window.innerHeight - 300),
  );

  useEffect(() => {
    const updateHeight = () => {
      setTableHeight(Math.max(260, window.innerHeight - 300));
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  const controller = useVmListController({
    vms: proxmox.vms,
    node: proxmox.node,
    refreshVMs: proxmox.refreshVMs,
  });

  const columns = useMemo(
    () =>
      buildVmListColumns({
        onStart: controller.handleStart,
        onStop: controller.handleStop,
        onRename: controller.openRenameModal,
        onRecreate,
      }),
    [controller.handleStart, controller.handleStop, controller.openRenameModal, onRecreate],
  );

  const rename = useMemo(
    () => ({
      target: controller.renameTarget,
      value: controller.renameValue,
      saving: controller.renameSaving,
      onValueChange: controller.setRenameValue,
      onCancel: controller.closeRenameModal,
      onSubmit: controller.handleRenameSubmit,
    }),
    [
      controller.closeRenameModal,
      controller.handleRenameSubmit,
      controller.renameSaving,
      controller.renameTarget,
      controller.renameValue,
      controller.setRenameValue,
    ],
  );

  return (
    <VMListView
      vms={proxmox.vms}
      loading={proxmox.loading}
      connected={proxmox.connected}
      refreshVMs={proxmox.refreshVMs}
      tableHeight={tableHeight}
      runningCount={controller.runningCount}
      stoppedCount={controller.stoppedCount}
      columns={columns}
      rename={rename}
    />
  );
};
