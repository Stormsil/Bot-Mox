import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import type { ApiKeys, NotificationEvents, ProxySettings, StoragePolicy } from '../../../types';
import {
  getApiKeys,
  getNotificationEvents,
  getProxySettings,
  getStoragePolicy,
  getThemeSettings,
  type ThemeSettings,
} from './settingsFacade';
import { settingsQueryKeys } from './settingsQueryKeys';

const SETTINGS_REFETCH_INTERVAL_MS = 12_000;

export function useApiKeysQuery(): UseQueryResult<ApiKeys, Error> {
  return useQuery<ApiKeys, Error>({
    queryKey: settingsQueryKeys.apiKeys(),
    queryFn: getApiKeys,
    refetchInterval: SETTINGS_REFETCH_INTERVAL_MS,
  });
}

export function useProxySettingsQuery(): UseQueryResult<ProxySettings, Error> {
  return useQuery<ProxySettings, Error>({
    queryKey: settingsQueryKeys.proxy(),
    queryFn: getProxySettings,
    refetchInterval: SETTINGS_REFETCH_INTERVAL_MS,
  });
}

export function useNotificationEventsQuery(): UseQueryResult<NotificationEvents, Error> {
  return useQuery<NotificationEvents, Error>({
    queryKey: settingsQueryKeys.notifications(),
    queryFn: getNotificationEvents,
    refetchInterval: SETTINGS_REFETCH_INTERVAL_MS,
  });
}

export function useThemeSettingsQuery(): UseQueryResult<ThemeSettings, Error> {
  return useQuery<ThemeSettings, Error>({
    queryKey: settingsQueryKeys.theme(),
    queryFn: getThemeSettings,
    refetchInterval: SETTINGS_REFETCH_INTERVAL_MS,
  });
}

export function useStoragePolicyQuery(): UseQueryResult<StoragePolicy, Error> {
  return useQuery<StoragePolicy, Error>({
    queryKey: settingsQueryKeys.storagePolicy(),
    queryFn: getStoragePolicy,
    refetchInterval: SETTINGS_REFETCH_INTERVAL_MS,
  });
}
