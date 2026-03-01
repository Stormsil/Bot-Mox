import type { CrudFilter } from '@refinedev/core';
import type {
  ComputedSubscriptionStatus,
  Subscription,
  SubscriptionFormData,
  SubscriptionWithDetails,
} from '../../entities/resources/model/types';

export interface BotOption {
  id: string;
  name: string;
  character?: string;
  status: string;
  account_email?: string;
  vmName?: string;
}

export function readFilterValue(filters: CrudFilter[], field: string, fallback: string): string {
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

export function buildTableFilters(values: { q: string }): CrudFilter[] {
  if (!values.q.trim()) {
    return [];
  }
  return [{ field: 'q', operator: 'eq', value: values.q.trim() }];
}

function parseDateToTimestamp(dateString: string): number {
  if (!dateString || typeof dateString !== 'string') {
    return Number.NaN;
  }

  const parts = dateString.split('.');
  if (parts.length !== 3) {
    return Number.NaN;
  }

  const [day, month, year] = parts.map(Number);
  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) {
    return Number.NaN;
  }

  return new Date(year, month - 1, day, 23, 59, 59, 999).getTime();
}

export function toCreateSubscriptionPayload(data: SubscriptionFormData): Omit<Subscription, 'id'> {
  const expiresAtTimestamp = parseDateToTimestamp(data.expires_at);
  if (!Number.isFinite(expiresAtTimestamp)) {
    throw new Error(`Invalid expires_at format: ${data.expires_at}. Expected DD.MM.YYYY`);
  }

  const now = Date.now();
  return {
    type: data.type,
    status: 'active',
    expires_at: expiresAtTimestamp,
    created_at: now,
    updated_at: now,
    bot_id: data.bot_id,
    ...(data.account_email && { account_email: data.account_email }),
    auto_renew: data.auto_renew ?? false,
    ...(data.project_id && { project_id: data.project_id }),
    ...(data.notes && { notes: data.notes }),
  };
}

export function toUpdateSubscriptionPayload(
  data: Partial<SubscriptionFormData>,
): Partial<Subscription> {
  const updates: Partial<Subscription> = {
    updated_at: Date.now(),
  };

  if (data.type !== undefined) updates.type = data.type;
  if (data.expires_at !== undefined) {
    const expiresAtTimestamp = parseDateToTimestamp(data.expires_at);
    if (!Number.isFinite(expiresAtTimestamp)) {
      throw new Error(`Invalid expires_at format: ${data.expires_at}. Expected DD.MM.YYYY`);
    }
    updates.expires_at = expiresAtTimestamp;
  }
  if (data.bot_id !== undefined) updates.bot_id = data.bot_id;
  if (data.account_email !== undefined) updates.account_email = data.account_email;
  if (data.auto_renew !== undefined) updates.auto_renew = data.auto_renew;
  if (data.project_id !== undefined) updates.project_id = data.project_id;
  if (data.notes !== undefined) updates.notes = data.notes;

  return updates;
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

export function computeSubscriptionsStats(subscriptions: SubscriptionWithDetails[]): {
  total: number;
  active: number;
  expired: number;
  expiringSoon: number;
} {
  return {
    total: subscriptions.length,
    active: subscriptions.filter((sub) => sub.computedStatus === 'active').length,
    expired: subscriptions.filter((sub) => sub.computedStatus === 'expired').length,
    expiringSoon: subscriptions.filter((sub) => sub.computedStatus === 'expiring_soon').length,
  };
}

export function filterSubscriptionsByStatus(
  subscriptions: SubscriptionWithDetails[],
  statusFilter: ComputedSubscriptionStatus | 'all',
): SubscriptionWithDetails[] {
  return subscriptions.filter(
    (sub) => statusFilter === 'all' || sub.computedStatus === statusFilter,
  );
}

export function getExpiringSoonSubscriptions(
  subscriptions: SubscriptionWithDetails[],
): SubscriptionWithDetails[] {
  return subscriptions
    .filter((sub) => sub.computedStatus === 'expiring_soon')
    .sort((a, b) => a.expires_at - b.expires_at);
}
