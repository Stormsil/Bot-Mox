import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import {
  fetchBotByIdViaContract,
  fetchBotsListViaContract,
} from '../../../providers/bot-contract-client';
import type { BotRecord } from '../model/types';
import { botQueryKeys } from './botQueryKeys';

const BOT_REFETCH_INTERVAL_MS = 5_000;

export function useBotsListQuery(): UseQueryResult<BotRecord[], Error> {
  return useQuery<BotRecord[], Error>({
    queryKey: botQueryKeys.list('all'),
    queryFn: fetchBotsListViaContract,
    refetchInterval: BOT_REFETCH_INTERVAL_MS,
  });
}

export function useBotsMapQuery(): UseQueryResult<Record<string, BotRecord>, Error> {
  return useQuery<BotRecord[], Error, Record<string, BotRecord>>({
    queryKey: botQueryKeys.list('all'),
    queryFn: fetchBotsListViaContract,
    refetchInterval: BOT_REFETCH_INTERVAL_MS,
    select: (list) =>
      list.reduce<Record<string, BotRecord>>((acc, bot) => {
        acc[bot.id] = bot;
        return acc;
      }, {}),
  });
}

export function useBotByIdQuery(botId?: string): UseQueryResult<BotRecord | null, Error> {
  const id = String(botId || '').trim();
  return useQuery<BotRecord | null, Error>({
    queryKey: botQueryKeys.byId(id || 'unknown'),
    queryFn: () => fetchBotByIdViaContract(id),
    enabled: id.length > 0,
    refetchInterval: BOT_REFETCH_INTERVAL_MS,
  });
}
