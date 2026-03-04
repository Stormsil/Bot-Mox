import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import type { ApiKeys, NotificationEvents, ProxySettings, StoragePolicy } from '../model/types';
import {
  getApiKeys,
  getNotificationEvents,
  getProxySettings,
  getStoragePolicy,
  getThemeSettings,
  type ThemeSettings,
} from './settingsFacade';
import { settingsQueryKeys } from './settingsQueryKeys';

export function useApiKeysQuery(): UseQueryResult<ApiKeys, Error> {
  return useQuery<ApiKeys, Error>({
    queryKey: settingsQueryKeys.apiKeys(),
    queryFn: getApiKeys,
  });
}

export function useProxySettingsQuery(): UseQueryResult<ProxySettings, Error> {
  return useQuery<ProxySettings, Error>({
    queryKey: settingsQueryKeys.proxy(),
    queryFn: getProxySettings,
  });
}

export function useNotificationEventsQuery(): UseQueryResult<NotificationEvents, Error> {
  return useQuery<NotificationEvents, Error>({
    queryKey: settingsQueryKeys.notifications(),
    queryFn: getNotificationEvents,
  });
}

export function useThemeSettingsQuery(): UseQueryResult<ThemeSettings, Error> {
  return useQuery<ThemeSettings, Error>({
    queryKey: settingsQueryKeys.theme(),
    queryFn: getThemeSettings,
  });
}

export function useStoragePolicyQuery(): UseQueryResult<StoragePolicy, Error> {
  return useQuery<StoragePolicy, Error>({
    queryKey: settingsQueryKeys.storagePolicy(),
    queryFn: getStoragePolicy,
  });
}
