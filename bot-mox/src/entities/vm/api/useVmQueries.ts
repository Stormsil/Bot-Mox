import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import type { VMGeneratorSettings } from '../../../types';
import { getVmSetupProgress, type VmSetupProgressEntry } from './vmLegacyFacade';
import { vmQueryKeys } from './vmQueryKeys';
import { listProxmoxTargets, type ProxmoxTargetInfo } from './vmReadFacade';
import { getVMSettings } from './vmSettingsFacade';

export function useVmSettingsQuery(): UseQueryResult<VMGeneratorSettings, Error> {
  return useQuery<VMGeneratorSettings, Error>({
    queryKey: vmQueryKeys.settings(),
    queryFn: getVMSettings,
  });
}

export function useProxmoxTargetsQuery(): UseQueryResult<ProxmoxTargetInfo[], Error> {
  return useQuery<ProxmoxTargetInfo[], Error>({
    queryKey: vmQueryKeys.proxmoxTargets(),
    queryFn: listProxmoxTargets,
  });
}

export function useVmSetupProgressQuery(
  vmUuid: string,
  pollIntervalMs = 5_000,
): UseQueryResult<VmSetupProgressEntry[], Error> {
  const normalizedVmUuid = String(vmUuid || '').trim();

  return useQuery<VmSetupProgressEntry[], Error>({
    queryKey: vmQueryKeys.setupProgressByVmUuid(normalizedVmUuid),
    enabled: normalizedVmUuid.length > 0,
    queryFn: async () => {
      const envelope = await getVmSetupProgress(normalizedVmUuid);
      return envelope.data || [];
    },
    refetchInterval: pollIntervalMs,
  });
}
