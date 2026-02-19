import type {
  BotStatus,
  ComputedSubscriptionStatus,
  Subscription,
  SubscriptionFormData,
  SubscriptionWithDetails,
} from '../../../types';
import {
  createResourceViaContractMutation,
  deleteResourceViaContractMutation,
  updateResourceViaContractMutation,
} from './resourceContractFacade';

interface SubscriptionStatusDetails {
  computedStatus: ComputedSubscriptionStatus;
  daysRemaining: number;
  isExpired: boolean;
  isExpiringSoon: boolean;
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

  const date = new Date(year, month - 1, day, 23, 59, 59, 999);
  return date.getTime();
}

function calculateSubscriptionStatus(
  subscription: Subscription,
  warningDays: number,
): SubscriptionStatusDetails {
  const now = Date.now();
  const daysRemaining = Math.ceil((subscription.expires_at - now) / (1000 * 60 * 60 * 24));
  const isExpired = now > subscription.expires_at;
  const isExpiringSoon = daysRemaining <= warningDays && daysRemaining > 0;

  const computedStatus: ComputedSubscriptionStatus = isExpired
    ? 'expired'
    : isExpiringSoon
      ? 'expiring_soon'
      : 'active';

  return {
    computedStatus,
    daysRemaining: isExpired ? 0 : Math.max(0, daysRemaining),
    isExpired,
    isExpiringSoon,
  };
}

export async function createSubscription(data: SubscriptionFormData): Promise<string> {
  if (!data) {
    throw new Error('Subscription data is required');
  }
  if (!data.bot_id) {
    throw new Error('bot_id is required');
  }
  if (!data.type) {
    throw new Error('type is required');
  }
  if (!data.expires_at) {
    throw new Error('expires_at is required');
  }

  const expiresAtTimestamp = parseDateToTimestamp(data.expires_at);
  if (!Number.isFinite(expiresAtTimestamp)) {
    throw new Error(`Invalid expires_at format: ${data.expires_at}. Expected DD.MM.YYYY`);
  }

  const now = Date.now();
  const payload: Omit<Subscription, 'id'> = {
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

  const created = await createResourceViaContractMutation<Subscription>(
    'subscriptions',
    payload as unknown as Record<string, unknown>,
  );

  if (!created?.id) {
    throw new Error('Failed to create subscription');
  }

  return created.id;
}

export async function updateSubscription(
  id: string,
  data: Partial<SubscriptionFormData>,
): Promise<void> {
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

  await updateResourceViaContractMutation<Subscription>(
    'subscriptions',
    id,
    updates as unknown as Record<string, unknown>,
  );
}

export async function deleteSubscription(id: string): Promise<void> {
  await deleteResourceViaContractMutation('subscriptions', id);
}

export function enrichSubscriptionsWithDetails(
  subscriptions: Subscription[],
  warningDays: number = 7,
  botsMap?: Map<string, { name: string; character?: string; status?: BotStatus; vmName?: string }>,
): SubscriptionWithDetails[] {
  return subscriptions.map((subscription) => {
    const statusInfo = calculateSubscriptionStatus(subscription, warningDays);
    const botInfo = botsMap?.get(subscription.bot_id);

    return {
      ...subscription,
      ...statusInfo,
      botName: botInfo?.name,
      botCharacter: botInfo?.character,
      botStatus: botInfo?.status,
      botVmName: botInfo?.vmName,
    };
  });
}
