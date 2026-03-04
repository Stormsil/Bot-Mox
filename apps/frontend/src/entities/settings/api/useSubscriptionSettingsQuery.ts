import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import type { SubscriptionSettings } from '../../resources/model/types';
import { getDefaultSettings, getSubscriptionSettings } from './settingsFacade';
import { settingsQueryKeys } from './settingsQueryKeys';

export function useSubscriptionSettingsQuery(): UseQueryResult<SubscriptionSettings, Error> {
  return useQuery<SubscriptionSettings, Error>({
    queryKey: settingsQueryKeys.subscriptionAlerts(),
    queryFn: getSubscriptionSettings,
    placeholderData: getDefaultSettings,
  });
}
