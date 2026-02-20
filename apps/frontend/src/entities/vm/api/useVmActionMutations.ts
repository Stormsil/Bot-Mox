import { type UseMutationResult, useMutation } from '@tanstack/react-query';
import {
  proxmoxLogin,
  startAndSendKeyBatch,
  startVM,
  stopVM,
  updateVMConfig,
  updateVMSettings,
  waitForTask,
} from './vmRuntimeFacade';

interface StartStopVmPayload {
  vmid: number;
  node?: string;
}

interface UpdateVmConfigPayload {
  vmid: number;
  node?: string;
  config: Record<string, string | number | boolean | undefined>;
}

interface WaitForTaskPayload {
  upid: string;
  node?: string;
  options?: { timeoutMs?: number; intervalMs?: number };
}

interface StartAndSendKeyBatchPayload {
  vmIds: number[];
  options: {
    node?: string;
    key?: string;
    repeatCount?: number;
    intervalMs?: number;
    startupDelayMs?: number;
  };
}

export function useStartVmMutation(): UseMutationResult<void, Error, StartStopVmPayload> {
  return useMutation<void, Error, StartStopVmPayload>({
    mutationFn: async ({ vmid, node }) => {
      await startVM(vmid, node);
    },
  });
}

export function useStopVmMutation(): UseMutationResult<void, Error, StartStopVmPayload> {
  return useMutation<void, Error, StartStopVmPayload>({
    mutationFn: async ({ vmid, node }) => {
      await stopVM(vmid, node);
    },
  });
}

export function useUpdateVmConfigMutation(): UseMutationResult<
  Awaited<ReturnType<typeof updateVMConfig>>,
  Error,
  UpdateVmConfigPayload
> {
  return useMutation<Awaited<ReturnType<typeof updateVMConfig>>, Error, UpdateVmConfigPayload>({
    mutationFn: async ({ vmid, node, config }) => updateVMConfig({ vmid, node, config }),
  });
}

export function useWaitForVmTaskMutation(): UseMutationResult<
  Awaited<ReturnType<typeof waitForTask>>,
  Error,
  WaitForTaskPayload
> {
  return useMutation<Awaited<ReturnType<typeof waitForTask>>, Error, WaitForTaskPayload>({
    mutationFn: async ({ upid, node, options }) => waitForTask(upid, node, options),
  });
}

export function useStartAndSendKeyBatchMutation(): UseMutationResult<
  Awaited<ReturnType<typeof startAndSendKeyBatch>>,
  Error,
  StartAndSendKeyBatchPayload
> {
  return useMutation<
    Awaited<ReturnType<typeof startAndSendKeyBatch>>,
    Error,
    StartAndSendKeyBatchPayload
  >({
    mutationFn: async ({ vmIds, options }) => startAndSendKeyBatch(vmIds, options),
  });
}

export function useProxmoxLoginMutation(): UseMutationResult<boolean, Error, void> {
  return useMutation<boolean, Error, void>({
    mutationFn: async () => proxmoxLogin(),
  });
}

export function useUpdateVmSettingsMutation(): UseMutationResult<
  void,
  Error,
  Record<string, unknown>
> {
  return useMutation<void, Error, Record<string, unknown>>({
    mutationFn: async (payload) => {
      await updateVMSettings(payload);
    },
  });
}
