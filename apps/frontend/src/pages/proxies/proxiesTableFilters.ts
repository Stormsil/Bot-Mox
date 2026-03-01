import type { CrudFilter } from '@refinedev/core';

const ALLOWED_STATUS_FILTERS = new Set(['all', 'active', 'expired', 'banned']);
const ALLOWED_TYPE_FILTERS = new Set(['all', 'http', 'socks5']);

export interface ProxiesTableFilterValues {
  q: string;
  status: string;
  type: string;
  country: string;
}

export const DEFAULT_PROXIES_TABLE_FILTERS: ProxiesTableFilterValues = {
  q: '',
  status: 'all',
  type: 'all',
  country: 'all',
};

function readFilterValue(filters: CrudFilter[], field: string, fallback: string): string {
  const match = filters.find(
    (item) => 'field' in item && String(item.field) === field && 'value' in item,
  );
  if (!match || !('value' in match)) {
    return fallback;
  }
  const value = match.value;
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  return String(value);
}

function readEnumFilterValue(
  filters: CrudFilter[],
  field: string,
  fallback: string,
  allowedValues: Set<string>,
): string {
  const value = readFilterValue(filters, field, fallback);
  return allowedValues.has(value) ? value : fallback;
}

export function readProxiesTableFilterValues(filters: CrudFilter[]): ProxiesTableFilterValues {
  return {
    q: readFilterValue(filters, 'q', DEFAULT_PROXIES_TABLE_FILTERS.q),
    status: readEnumFilterValue(
      filters,
      'status',
      DEFAULT_PROXIES_TABLE_FILTERS.status,
      ALLOWED_STATUS_FILTERS,
    ),
    type: readEnumFilterValue(
      filters,
      'type',
      DEFAULT_PROXIES_TABLE_FILTERS.type,
      ALLOWED_TYPE_FILTERS,
    ),
    country: readFilterValue(filters, 'country', DEFAULT_PROXIES_TABLE_FILTERS.country),
  };
}

export function buildProxiesTableFilters(values: ProxiesTableFilterValues): CrudFilter[] {
  const next: CrudFilter[] = [];

  if (values.q.trim()) {
    next.push({ field: 'q', operator: 'eq', value: values.q.trim() });
  }
  if (values.status !== DEFAULT_PROXIES_TABLE_FILTERS.status) {
    next.push({ field: 'status', operator: 'eq', value: values.status });
  }
  if (values.type !== DEFAULT_PROXIES_TABLE_FILTERS.type) {
    next.push({ field: 'type', operator: 'eq', value: values.type });
  }
  if (values.country !== DEFAULT_PROXIES_TABLE_FILTERS.country) {
    next.push({ field: 'country', operator: 'eq', value: values.country });
  }

  return next;
}
