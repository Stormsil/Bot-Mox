import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  buildQueryString,
  createPollingSubscription,
} from './apiClient';

export type ResourceKind = 'licenses' | 'proxies' | 'subscriptions';

const PAGE_LIMIT = 200;
const MAX_PAGE_COUNT = 100;

interface ResourceRecord {
  id: string;
}

function hasStringId(value: unknown): value is { id: string } {
  if (!value || typeof value !== 'object') return false;
  const id = (value as { id?: unknown }).id;
  return typeof id === 'string' && id.trim().length > 0;
}

async function fetchResourcePage<T extends { id: string }>(
  kind: ResourceKind,
  page: number,
): Promise<{ items: T[]; total: number }> {
  const query = buildQueryString({
    page,
    limit: PAGE_LIMIT,
    sort: 'updated_at',
    order: 'desc',
  });

  const payload = await apiGet<T[]>(`/api/v1/resources/${kind}${query}`);
  const items = Array.isArray(payload.data)
    ? payload.data.filter((item): item is T => hasStringId(item))
    : [];
  const total = Number(payload.meta?.total ?? items.length);

  return {
    items,
    total: Number.isFinite(total) ? total : items.length,
  };
}

export async function fetchResources<T extends { id: string }>(kind: ResourceKind): Promise<T[]> {
  const all: T[] = [];

  for (let page = 1; page <= MAX_PAGE_COUNT; page += 1) {
    const { items, total } = await fetchResourcePage<T>(kind, page);
    all.push(...items);

    if (items.length === 0) break;
    if (all.length >= total) break;
    if (items.length < PAGE_LIMIT) break;
  }

  return all;
}

export async function createResource<T extends { id: string }>(
  kind: ResourceKind,
  payload: Record<string, unknown>,
): Promise<T> {
  const response = await apiPost<T>(`/api/v1/resources/${kind}`, payload);
  return response.data;
}

export async function updateResource<T extends { id: string }>(
  kind: ResourceKind,
  id: string,
  payload: Record<string, unknown>,
): Promise<T> {
  const response = await apiPatch<T>(
    `/api/v1/resources/${kind}/${encodeURIComponent(String(id || '').trim())}`,
    payload,
  );
  return response.data;
}

export async function deleteResource(kind: ResourceKind, id: string): Promise<void> {
  await apiDelete(`/api/v1/resources/${kind}/${encodeURIComponent(String(id || '').trim())}`);
}

interface SubscribeOptions {
  intervalMs?: number;
}

export function subscribeResources<T extends ResourceRecord>(
  kind: ResourceKind,
  onData: (items: T[]) => void,
  onError?: (error: Error) => void,
  options: SubscribeOptions = {},
): () => void {
  return createPollingSubscription(() => fetchResources<T>(kind), onData, onError, {
    key: `resources:${kind}`,
    intervalMs: options.intervalMs ?? 7000,
    immediate: true,
  });
}
