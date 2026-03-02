import { type UseMutationResult, useMutation } from '@tanstack/react-query';
import { message } from 'antd';
import { mutationToastOwnershipMetaKeys } from '../../../shared/lib/query/mutationToastOwnership';
import { vmQueryKeys } from './vmQueryKeys';
import {
  getVmHardwareFingerprint,
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
    meta: {
      [mutationToastOwnershipMetaKeys.suppressGlobalErrorToast]: true,
      [mutationToastOwnershipMetaKeys.localErrorToastOwner]: true,
      [mutationToastOwnershipMetaKeys.errorToastDedupeKey]: 'vm.start',
    },
    onSuccess: (_data, variables) => {
      message.success(`VM ${variables.vmid} start requested`);
    },
  });
}

export function useStopVmMutation(): UseMutationResult<void, Error, StartStopVmPayload> {
  return useMutation<void, Error, StartStopVmPayload>({
    mutationFn: async ({ vmid, node }) => {
      await stopVM(vmid, node);
    },
    meta: {
      [mutationToastOwnershipMetaKeys.suppressGlobalErrorToast]: true,
      [mutationToastOwnershipMetaKeys.localErrorToastOwner]: true,
      [mutationToastOwnershipMetaKeys.errorToastDedupeKey]: 'vm.stop',
    },
    onSuccess: (_data, variables) => {
      message.success(`VM ${variables.vmid} stop requested`);
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
    meta: {
      [mutationToastOwnershipMetaKeys.suppressGlobalErrorToast]: true,
      [mutationToastOwnershipMetaKeys.localErrorToastOwner]: true,
      [mutationToastOwnershipMetaKeys.errorToastDedupeKey]: 'vm.updateConfig',
    },
  });
}

export function useWaitForVmTaskMutation(): UseMutationResult<
  Awaited<ReturnType<typeof waitForTask>>,
  Error,
  WaitForTaskPayload
> {
  return useMutation<Awaited<ReturnType<typeof waitForTask>>, Error, WaitForTaskPayload>({
    mutationFn: async ({ upid, node, options }) => waitForTask(upid, node, options),
    meta: {
      [mutationToastOwnershipMetaKeys.suppressGlobalErrorToast]: true,
      [mutationToastOwnershipMetaKeys.localErrorToastOwner]: true,
      [mutationToastOwnershipMetaKeys.errorToastDedupeKey]: 'vm.waitTask',
    },
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
    meta: {
      [mutationToastOwnershipMetaKeys.suppressGlobalErrorToast]: true,
      [mutationToastOwnershipMetaKeys.localErrorToastOwner]: true,
      [mutationToastOwnershipMetaKeys.errorToastDedupeKey]: 'vm.startBatch',
    },
  });
}

export function useProxmoxLoginMutation(): UseMutationResult<boolean, Error, void> {
  return useMutation<boolean, Error, void>({
    mutationFn: async () => proxmoxLogin(),
  });
}

export function useVmHardwareFingerprintMutation(): UseMutationResult<
  Awaited<ReturnType<typeof getVmHardwareFingerprint>>,
  Error,
  void
> {
  return useMutation<Awaited<ReturnType<typeof getVmHardwareFingerprint>>, Error, void>({
    mutationKey: vmQueryKeys.hardwareFingerprint(),
    mutationFn: async () => getVmHardwareFingerprint(),
    meta: {
      [mutationToastOwnershipMetaKeys.suppressGlobalErrorToast]: true,
      [mutationToastOwnershipMetaKeys.localErrorToastOwner]: true,
      [mutationToastOwnershipMetaKeys.errorToastDedupeKey]: 'vm.hardwareFingerprint',
    },
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
    meta: {
      [mutationToastOwnershipMetaKeys.suppressGlobalErrorToast]: true,
      [mutationToastOwnershipMetaKeys.localErrorToastOwner]: true,
      [mutationToastOwnershipMetaKeys.errorToastDedupeKey]: 'vm.updateSettings',
    },
  });
}
