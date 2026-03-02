import { type UseMutationResult, useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { mutationToastOwnershipMetaKeys } from '../../../shared/lib/query/mutationToastOwnership';
import type { BanDetails } from '../model/lifecycleTypes';
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
    meta: {
      [mutationToastOwnershipMetaKeys.suppressGlobalErrorToast]: true,
      [mutationToastOwnershipMetaKeys.localErrorToastOwner]: true,
      [mutationToastOwnershipMetaKeys.errorToastDedupeKey]: 'bot.ban',
    },
    onSuccess: async (_data, variables) => {
      message.success('Бот заблокирован и перемещён в архив');
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
    meta: {
      [mutationToastOwnershipMetaKeys.suppressGlobalErrorToast]: true,
      [mutationToastOwnershipMetaKeys.localErrorToastOwner]: true,
      [mutationToastOwnershipMetaKeys.errorToastDedupeKey]: 'bot.unban',
    },
    onSuccess: async (_data, botId) => {
      message.success('Бан снят, бот восстановлен');
      const id = String(botId || '').trim();
      if (id) {
        await queryClient.invalidateQueries({ queryKey: botQueryKeys.byId(id) });
      }
      await queryClient.invalidateQueries({ queryKey: botQueryKeys.lists() });
    },
  });
}
