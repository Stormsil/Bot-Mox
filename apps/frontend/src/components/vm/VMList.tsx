import type React from 'react';
import { useProxmox } from '../../hooks/useProxmox';
import { VMListContainer } from './VMListContainer';

export type { VMListContainerProps } from './VMListContainer';
export { VMListView } from './VMListView';

export const VMList: React.FC = () => {
  const proxmox = useProxmox();

  return (
    <VMListContainer
      vms={proxmox.vms}
      loading={proxmox.loading}
      connected={proxmox.connected}
      node={proxmox.node}
      refreshVMs={proxmox.refreshVMs}
    />
  );
};
