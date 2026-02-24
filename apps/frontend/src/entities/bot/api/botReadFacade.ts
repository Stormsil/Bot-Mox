import { fetchBotsListViaContract } from '../../../providers/bot-contract-client';
import type { BotRecord } from '../model/types';

export async function fetchBotsMapViaContract(): Promise<Record<string, BotRecord>> {
  const list = await fetchBotsListViaContract();

  return list.reduce<Record<string, BotRecord>>((acc, bot) => {
    acc[bot.id] = bot;
    return acc;
  }, {});
}
