import { type UseMutationResult, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Proxy as ProxyResource } from '../../../types';
import {
  createResourceViaContractMutation,
  deleteResourceViaContractMutation,
  updateResourceViaContractMutation,
} from './resourceContractFacade';
import { resourceQueryKeys } from './resourceQueryKeys';

interface UpdateProxyPayload {
  id: string;
  payload: Partial<ProxyResource>;
}

export function useUpdateProxyMutation(): UseMutationResult<
  ProxyResource,
  Error,
  UpdateProxyPayload
> {
  const queryClient = useQueryClient();

  return useMutation<ProxyResource, Error, UpdateProxyPayload>({
    mutationFn: async ({ id, payload }) =>
      updateResourceViaContractMutation<ProxyResource>(
        'proxies',
        id,
        payload as Record<string, unknown>,
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: resourceQueryKeys.list('proxies') });
    },
  });
}

export function useCreateProxyMutation(): UseMutationResult<
  ProxyResource,
  Error,
  Omit<ProxyResource, 'id'>
> {
  const queryClient = useQueryClient();

  return useMutation<ProxyResource, Error, Omit<ProxyResource, 'id'>>({
    mutationFn: async (payload) =>
      createResourceViaContractMutation<ProxyResource>(
        'proxies',
        payload as Record<string, unknown>,
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: resourceQueryKeys.list('proxies') });
    },
  });
}

export function useDeleteProxyMutation(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (proxyId) => {
      await deleteResourceViaContractMutation('proxies', proxyId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: resourceQueryKeys.list('proxies') });
    },
  });
}
