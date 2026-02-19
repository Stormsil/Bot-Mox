import { getWowNamesViaContract } from '../providers/wow-names-contract-client';

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

export async function getWowNames(
  options: { batches?: number; count?: number } = {},
): Promise<WowNamesResult> {
  const response = await getWowNamesViaContract({
    batches: options.batches,
    count: options.count,
  });
  return normalizeWowNamesPayload(response.data || {});
}
