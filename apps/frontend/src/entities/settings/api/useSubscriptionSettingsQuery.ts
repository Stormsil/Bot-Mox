import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import type { SubscriptionSettings } from '../../../types';
import { getDefaultSettings, getSubscriptionSettings } from './settingsFacade';
import { settingsQueryKeys } from './settingsQueryKeys';

const SUBSCRIPTION_SETTINGS_REFETCH_MS = 12_000;

export function useSubscriptionSettingsQuery(): UseQueryResult<SubscriptionSettings, Error> {
  return useQuery<SubscriptionSettings, Error>({
    queryKey: settingsQueryKeys.subscriptionAlerts(),
    queryFn: getSubscriptionSettings,
    refetchInterval: SUBSCRIPTION_SETTINGS_REFETCH_MS,
    placeholderData: getDefaultSettings,
  });
}
