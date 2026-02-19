export const vmQueryKeys = {
  all: ['vm'] as const,
  settings: () => [...vmQueryKeys.all, 'settings'] as const,
  proxmoxTargets: () => [...vmQueryKeys.all, 'proxmox-targets'] as const,
  setupProgress: () => [...vmQueryKeys.all, 'setup-progress'] as const,
  setupProgressByVmUuid: (vmUuid: string) => [...vmQueryKeys.setupProgress(), vmUuid] as const,
};
