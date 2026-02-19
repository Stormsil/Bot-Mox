import { type UseMutationResult, useMutation, useQueryClient } from '@tanstack/react-query';
import type { SubscriptionSettings } from '../../../types';
import { getDefaultSettings, updateSubscriptionSettings } from './settingsFacade';
import { settingsQueryKeys } from './settingsQueryKeys';

export function useUpdateSubscriptionSettingsMutation(): UseMutationResult<
  void,
  Error,
  Partial<SubscriptionSettings>
> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, Partial<SubscriptionSettings>>({
    mutationFn: async (payload) => {
      await updateSubscriptionSettings(payload);
    },
    onSuccess: (_data, payload) => {
      queryClient.setQueryData<SubscriptionSettings>(
        settingsQueryKeys.subscriptionAlerts(),
        (previous) => ({
          ...getDefaultSettings(),
          ...(previous || {}),
          ...payload,
          updated_at: Date.now(),
        }),
      );
    },
  });
}
