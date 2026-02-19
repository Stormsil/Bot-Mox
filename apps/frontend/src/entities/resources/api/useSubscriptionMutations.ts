import { type UseMutationResult, useMutation, useQueryClient } from '@tanstack/react-query';
import type { SubscriptionFormData } from '../../../types';
import { resourceQueryKeys } from './resourceQueryKeys';
import { createSubscription, deleteSubscription, updateSubscription } from './subscriptionFacade';

export function useCreateSubscriptionMutation(): UseMutationResult<
  string,
  Error,
  SubscriptionFormData
> {
  const queryClient = useQueryClient();

  return useMutation<string, Error, SubscriptionFormData>({
    mutationFn: async (payload) => createSubscription(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: resourceQueryKeys.list('subscriptions') });
    },
  });
}

interface UpdateSubscriptionPayload {
  id: string;
  payload: Partial<SubscriptionFormData>;
}

export function useUpdateSubscriptionMutation(): UseMutationResult<
  void,
  Error,
  UpdateSubscriptionPayload
> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, UpdateSubscriptionPayload>({
    mutationFn: async ({ id, payload }) => {
      await updateSubscription(id, payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: resourceQueryKeys.list('subscriptions') });
    },
  });
}

export function useDeleteSubscriptionMutation(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await deleteSubscription(id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: resourceQueryKeys.list('subscriptions') });
    },
  });
}
