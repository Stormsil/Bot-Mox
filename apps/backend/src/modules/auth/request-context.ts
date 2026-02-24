import { AsyncLocalStorage } from 'node:async_hooks';

type RequestContextStore = {
  tenantId?: string;
};

const requestContextStorage = new AsyncLocalStorage<RequestContextStore>();

export function runWithRequestContext<T>(handler: () => T): T {
  return requestContextStorage.run({}, handler);
}

export function setRequestTenantId(tenantId: string | null | undefined): void {
  const store = requestContextStorage.getStore();
  if (!store) {
    return;
  }
  const normalized = String(tenantId || '')
    .trim()
    .toLowerCase();
  if (!normalized) {
    delete store.tenantId;
    return;
  }
  store.tenantId = normalized;
}

export function getRequestTenantId(): string | null {
  const store = requestContextStorage.getStore();
  const tenantId = String(store?.tenantId || '')
    .trim()
    .toLowerCase();
  return tenantId || null;
}
