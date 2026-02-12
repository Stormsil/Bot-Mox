import type { Bot } from '../types';
import { ApiClientError, apiDelete, apiGet, buildQueryString, createPollingSubscription } from './apiClient';

const PAGE_LIMIT = 200;
const MAX_PAGE_COUNT = 100;

export interface BotRecord extends Bot {
  vm?: {
    name?: string;
  };
  [key: string]: unknown;
  id: string;
}

function toBotRecord(value: unknown): BotRecord | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  const id = typeof source.id === 'string' ? source.id.trim() : '';
  if (!id) return null;

  return source as unknown as BotRecord;
}

function toBotMap(list: BotRecord[]): Record<string, BotRecord> {
  const map: Record<string, BotRecord> = {};
  list.forEach((bot) => {
    map[bot.id] = bot;
  });
  return map;
}

async function fetchBotsPage(page: number): Promise<{ items: BotRecord[]; total: number }> {
  const query = buildQueryString({
    page,
    limit: PAGE_LIMIT,
    sort: 'updated_at',
    order: 'desc',
  });
  const payload = await apiGet<BotRecord[]>(`/api/v1/bots${query}`);
  const items = Array.isArray(payload.data)
    ? payload.data.map((item) => toBotRecord(item)).filter((item): item is BotRecord => item !== null)
    : [];
  const total = Number(payload.meta?.total ?? items.length);
  return { items, total: Number.isFinite(total) ? total : items.length };
}

export async function fetchAllBots(): Promise<BotRecord[]> {
  const all: BotRecord[] = [];

  for (let page = 1; page <= MAX_PAGE_COUNT; page += 1) {
    const { items, total } = await fetchBotsPage(page);
    all.push(...items);

    if (items.length === 0) break;
    if (all.length >= total) break;
    if (items.length < PAGE_LIMIT) break;
  }

  return all;
}

export async function fetchBotsList(): Promise<BotRecord[]> {
  return fetchAllBots();
}

export async function fetchBotsMap(): Promise<Record<string, BotRecord>> {
  const bots = await fetchAllBots();
  return toBotMap(bots);
}

export async function fetchBotById(botId: string): Promise<BotRecord | null> {
  const id = String(botId || '').trim();
  if (!id) return null;

  try {
    const payload = await apiGet<BotRecord>(`/api/v1/bots/${encodeURIComponent(id)}`);
    return toBotRecord(payload.data);
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function deleteBot(botId: string): Promise<void> {
  const id = String(botId || '').trim();
  if (!id) {
    throw new Error('botId is required');
  }

  await apiDelete(`/api/v1/bots/${encodeURIComponent(id)}`);
}

interface SubscribeOptions {
  intervalMs?: number;
}

export function subscribeBotsList(
  onData: (bots: BotRecord[]) => void,
  onError?: (error: Error) => void,
  options: SubscribeOptions = {}
): () => void {
  return createPollingSubscription(fetchBotsList, onData, onError, {
    intervalMs: options.intervalMs ?? 5000,
    immediate: true,
  });
}

export function subscribeBotsMap(
  onData: (bots: Record<string, BotRecord>) => void,
  onError?: (error: Error) => void,
  options: SubscribeOptions = {}
): () => void {
  return createPollingSubscription(fetchBotsMap, onData, onError, {
    intervalMs: options.intervalMs ?? 5000,
    immediate: true,
  });
}

export function subscribeBotById(
  botId: string,
  onData: (bot: BotRecord | null) => void,
  onError?: (error: Error) => void,
  options: SubscribeOptions = {}
): () => void {
  const id = String(botId || '').trim();
  if (!id) {
    onData(null);
    return () => undefined;
  }

  return createPollingSubscription(() => fetchBotById(id), onData, onError, {
    intervalMs: options.intervalMs ?? 5000,
    immediate: true,
  });
}
