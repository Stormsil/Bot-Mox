import { type UseMutationResult, useMutation, useQueryClient } from '@tanstack/react-query';
import type { BotLicense } from '../../../types';
import {
  createResourceViaContractMutation,
  deleteResourceViaContractMutation,
  updateResourceViaContractMutation,
} from './resourceContractFacade';
import { resourceQueryKeys } from './resourceQueryKeys';

export function useCreateLicenseMutation(): UseMutationResult<
  BotLicense,
  Error,
  Omit<BotLicense, 'id'>
> {
  const queryClient = useQueryClient();

  return useMutation<BotLicense, Error, Omit<BotLicense, 'id'>>({
    mutationFn: async (payload) =>
      createResourceViaContractMutation<BotLicense>('licenses', payload as Record<string, unknown>),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: resourceQueryKeys.list('licenses') });
    },
  });
}

interface UpdateLicensePayload {
  id: string;
  payload: Partial<BotLicense>;
}

export function useUpdateLicenseMutation(): UseMutationResult<
  BotLicense,
  Error,
  UpdateLicensePayload
> {
  const queryClient = useQueryClient();

  return useMutation<BotLicense, Error, UpdateLicensePayload>({
    mutationFn: async ({ id, payload }) =>
      updateResourceViaContractMutation<BotLicense>(
        'licenses',
        id,
        payload as Record<string, unknown>,
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: resourceQueryKeys.list('licenses') });
    },
  });
}

export function useDeleteLicenseMutation(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await deleteResourceViaContractMutation('licenses', id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: resourceQueryKeys.list('licenses') });
    },
  });
}
