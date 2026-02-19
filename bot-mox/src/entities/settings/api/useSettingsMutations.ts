import { type UseMutationResult, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApiKeys, NotificationEvents, ProxySettings, StoragePolicy } from '../../../types';
import {
  updateApiKeys,
  updateNotificationEvents,
  updateProxySettings,
  updateStoragePolicy,
} from './settingsFacade';
import { settingsQueryKeys } from './settingsQueryKeys';

export function useUpdateApiKeysMutation(): UseMutationResult<void, Error, ApiKeys> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, ApiKeys>({
    mutationFn: async (payload) => {
      await updateApiKeys(payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: settingsQueryKeys.apiKeys() });
    },
  });
}

export function useUpdateProxySettingsMutation(): UseMutationResult<void, Error, ProxySettings> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, ProxySettings>({
    mutationFn: async (payload) => {
      await updateProxySettings(payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: settingsQueryKeys.proxy() });
    },
  });
}

export function useUpdateNotificationEventsMutation(): UseMutationResult<
  void,
  Error,
  NotificationEvents
> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, NotificationEvents>({
    mutationFn: async (payload) => {
      await updateNotificationEvents(payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: settingsQueryKeys.notifications() });
    },
  });
}

export function useUpdateStoragePolicyMutation(): UseMutationResult<
  void,
  Error,
  Partial<StoragePolicy>
> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, Partial<StoragePolicy>>({
    mutationFn: async (payload) => {
      await updateStoragePolicy(payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: settingsQueryKeys.storagePolicy() });
    },
  });
}
