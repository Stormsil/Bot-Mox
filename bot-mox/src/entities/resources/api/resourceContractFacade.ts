import {
  createResourceViaContract,
  deleteResourceViaContract,
  listResourcesViaContract,
  updateResourceViaContract,
} from '../../../providers/resource-contract-client';
import type { ResourceKind } from '../model/types';

const PAGE_LIMIT = 200;
const MAX_PAGE_COUNT = 100;

function hasStringId(value: unknown): value is { id: string } {
  if (!value || typeof value !== 'object') return false;
  const id = (value as { id?: unknown }).id;
  return typeof id === 'string' && id.trim().length > 0;
}

async function fetchResourcePage<T extends { id: string }>(
  kind: ResourceKind,
  page: number,
): Promise<{ items: T[]; total: number }> {
  const response = await listResourcesViaContract(kind, {
    page,
    limit: PAGE_LIMIT,
    sort: 'updated_at',
    order: 'desc',
  });

  const items = Array.isArray(response.data)
    ? response.data.filter((item): item is T => hasStringId(item))
    : [];
  const total = Number(response.meta?.total ?? items.length);

  return {
    items,
    total: Number.isFinite(total) ? total : items.length,
  };
}

export async function fetchResourcesViaContract<T extends { id: string }>(
  kind: ResourceKind,
): Promise<T[]> {
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

export async function createResourceViaContractMutation<T extends { id: string }>(
  kind: ResourceKind,
  payload: Record<string, unknown>,
): Promise<T> {
  const response = await createResourceViaContract(kind, payload);
  return response.data as T;
}

export async function updateResourceViaContractMutation<T extends { id: string }>(
  kind: ResourceKind,
  id: string,
  payload: Record<string, unknown>,
): Promise<T> {
  const response = await updateResourceViaContract(kind, id, payload);
  return response.data as T;
}

export async function deleteResourceViaContractMutation(
  kind: ResourceKind,
  id: string,
): Promise<void> {
  await deleteResourceViaContract(kind, id);
}
