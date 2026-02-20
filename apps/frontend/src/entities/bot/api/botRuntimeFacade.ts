import { banBotViaContract, unbanBotViaContract } from '../../../providers/bot-contract-client';
import { getWowNamesViaContract } from '../../../providers/wow-names-contract-client';
import type { BanDetails } from '../../../types';

interface WowNamesPayload {
  names?: unknown;
  random?: unknown;
  source?: unknown;
  batches?: unknown;
}

export interface WowNamesResult {
  names: string[];
  random: string;
  source: string;
  batches: number;
}

function normalizeWowNamesPayload(payload: WowNamesPayload): WowNamesResult {
  const names = Array.isArray(payload.names)
    ? payload.names.filter(
        (item): item is string => typeof item === 'string' && item.trim().length > 0,
      )
    : [];

  return {
    names,
    random: typeof payload.random === 'string' ? payload.random : '',
    source: typeof payload.source === 'string' ? payload.source : '',
    batches: typeof payload.batches === 'number' ? payload.batches : 0,
  };
}

export async function banBot(botId: string, banDetails: BanDetails): Promise<void> {
  if (!botId) {
    throw new Error('botId is required');
  }

  if (!banDetails.ban_date || !banDetails.ban_reason || !banDetails.ban_mechanism) {
    throw new Error('ban_date, ban_reason, and ban_mechanism are required');
  }

  await banBotViaContract(botId, banDetails);
}

export async function unbanBot(botId: string): Promise<void> {
  if (!botId) {
    throw new Error('botId is required');
  }

  await unbanBotViaContract(botId);
}

export async function getWowNames(
  options: { batches?: number; count?: number } = {},
): Promise<WowNamesResult> {
  const response = await getWowNamesViaContract({
    batches: options.batches,
    count: options.count,
  });

  return normalizeWowNamesPayload(response.data || {});
}
