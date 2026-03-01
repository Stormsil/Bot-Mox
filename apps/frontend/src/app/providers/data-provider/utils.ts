import type { BaseRecord, GetListParams, GetListResponse } from '@refinedev/core';
import type { ApiSuccessEnvelope } from '../../../shared/api/apiClient';
import type { ContractResourceKind } from '../../../shared/api/providers/resource-contract-client';

export function resolveResourcePath(resource: string): string {
  const normalized = String(resource || '')
    .trim()
    .toLowerCase();

  if (normalized === 'licenses' || normalized === 'proxies' || normalized === 'subscriptions') {
    return `/api/v1/resources/${normalized}`;
  }

  if (normalized === 'notes' || normalized === 'notes_v2') {
    return '/api/v1/workspace/notes';
  }

  if (normalized === 'calendar' || normalized === 'calendar_events') {
    return '/api/v1/workspace/calendar';
  }

  if (normalized === 'kanban' || normalized === 'kanban_tasks') {
    return '/api/v1/workspace/kanban';
  }

  if (normalized === 'bots') {
    return '/api/v1/bots';
  }

  if (normalized === 'settings') {
    return '/api/v1/settings';
  }

  return `/api/v1/${normalized}`;
}

export function toContractResourceKind(resource: string): ContractResourceKind | null {
  const normalized = String(resource || '')
    .trim()
    .toLowerCase();
  if (normalized === 'licenses' || normalized === 'proxies' || normalized === 'subscriptions') {
    return normalized;
  }

  return null;
}

export function isBotResource(resource: string): boolean {
  return (
    String(resource || '')
      .trim()
      .toLowerCase() === 'bots'
  );
}

export function normalizeListResponse<TData extends BaseRecord = BaseRecord>(
  payload: ApiSuccessEnvelope<TData[]>,
): GetListResponse<TData> {
  const data = Array.isArray(payload.data) ? payload.data : [];
  const total = Number(payload.meta?.total ?? data.length);
  return { data, total };
}

export function extractQueryFromListParams(params: GetListParams): string {
  const search = new URLSearchParams();

  const pagination = params.pagination as
    | { current?: number; currentPage?: number; pageSize?: number }
    | undefined;
  if (
    pagination &&
    (pagination.current !== undefined ||
      pagination.currentPage !== undefined ||
      pagination.pageSize !== undefined)
  ) {
    const current = pagination.current ?? pagination.currentPage ?? 1;
    const pageSize = pagination.pageSize ?? 20;
    search.set('page', String(current));
    search.set('limit', String(pageSize));
  }

  if (params.sorters && params.sorters.length > 0) {
    const sorter = params.sorters[0];
    search.set('sort', String(sorter.field));
    search.set('order', sorter.order === 'desc' ? 'desc' : 'asc');
  }

  if (params.filters && params.filters.length > 0) {
    const queryFilter = params.filters.find(
      (item) => 'field' in item && String(item.field) === 'q',
    );
    if (queryFilter && 'value' in queryFilter && queryFilter.value) {
      search.set('q', String(queryFilter.value));
    }
  }

  const query = search.toString();
  return query ? `?${query}` : '';
}

export function extractContractQueryFromListParams(params: GetListParams): {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  q?: string;
  status?: string;
  type?: string;
  country?: string;
  country_code?: string;
  bot_id?: string;
} {
  const query: {
    page?: number;
    limit?: number;
    sort?: string;
    order?: 'asc' | 'desc';
    q?: string;
    status?: string;
    type?: string;
    country?: string;
    country_code?: string;
    bot_id?: string;
  } = {};

  const pagination = params.pagination as
    | { current?: number; currentPage?: number; pageSize?: number }
    | undefined;
  if (
    pagination &&
    (pagination.current !== undefined ||
      pagination.currentPage !== undefined ||
      pagination.pageSize !== undefined)
  ) {
    const current = Number(pagination.current ?? pagination.currentPage ?? 1);
    const pageSize = Number(pagination.pageSize ?? 20);
    query.page = Number.isFinite(current) && current > 0 ? current : 1;
    query.limit = Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 20;
  }

  if (params.sorters && params.sorters.length > 0) {
    const sorter = params.sorters[0];
    query.sort = String(sorter.field);
    query.order = sorter.order === 'desc' ? 'desc' : 'asc';
  }

  if (params.filters && params.filters.length > 0) {
    for (const filter of params.filters) {
      if (!('field' in filter) || !('value' in filter)) {
        continue;
      }

      const field = String(filter.field);
      const rawValue = filter.value;
      if (rawValue === undefined || rawValue === null || rawValue === '') {
        continue;
      }

      if (field === 'q') {
        query.q = String(rawValue);
        continue;
      }

      if (
        field === 'status' ||
        field === 'type' ||
        field === 'country' ||
        field === 'country_code' ||
        field === 'bot_id'
      ) {
        query[field] = String(rawValue);
      }
    }
  }

  return query;
}
