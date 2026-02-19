import { type UseMutationResult, useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteBotViaContract, patchBotViaContract } from '../../../providers/bot-contract-client';
import { botQueryKeys } from './botQueryKeys';

interface UpdateBotPayload {
  botId: string;
  payload: Record<string, unknown>;
}

export function useUpdateBotMutation(): UseMutationResult<void, Error, UpdateBotPayload> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, UpdateBotPayload>({
    mutationFn: async ({ botId, payload }) => {
      await patchBotViaContract(botId, payload);
    },
    onSuccess: async (_data, variables) => {
      const id = String(variables.botId || '').trim();
      if (id) {
        await queryClient.invalidateQueries({ queryKey: botQueryKeys.byId(id) });
      }
      await queryClient.invalidateQueries({ queryKey: botQueryKeys.lists() });
    },
  });
}

export function useDeleteBotMutation(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (botId) => {
      await deleteBotViaContract(botId);
    },
    onSuccess: async (_data, botId) => {
      const id = String(botId || '').trim();
      if (id) {
        await queryClient.invalidateQueries({ queryKey: botQueryKeys.byId(id) });
      }
      await queryClient.invalidateQueries({ queryKey: botQueryKeys.lists() });
    },
  });
}
