import { type UseMutationResult, useMutation, useQueryClient } from '@tanstack/react-query';
import type { BanDetails } from '../../../types';
import { botQueryKeys } from './botQueryKeys';
import { banBot, unbanBot } from './botRuntimeFacade';

interface BanBotPayload {
  botId: string;
  details: BanDetails;
}

export function useBanBotMutation(): UseMutationResult<void, Error, BanBotPayload> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, BanBotPayload>({
    mutationFn: async ({ botId, details }) => {
      await banBot(botId, details);
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

export function useUnbanBotMutation(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (botId) => {
      await unbanBot(botId);
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
