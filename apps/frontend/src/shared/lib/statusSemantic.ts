export type SemanticStatusIntent = 'success' | 'warning' | 'error' | 'info' | 'default';

export type BotPresentationStatus =
  | 'offline'
  | 'prepare'
  | 'leveling'
  | 'profession'
  | 'farming'
  | 'banned';

export type SubscriptionPresentationStatus = 'active' | 'expiring_soon' | 'expired';

export type LicensePresentationStatus = 'active' | 'revoked' | 'expired';

export const BOT_STATUS_TO_SEMANTIC_INTENT: Record<BotPresentationStatus, SemanticStatusIntent> = {
  offline: 'default',
  prepare: 'info',
  leveling: 'info',
  profession: 'warning',
  farming: 'success',
  banned: 'error',
};

export const SUBSCRIPTION_STATUS_TO_SEMANTIC_INTENT: Record<
  SubscriptionPresentationStatus,
  SemanticStatusIntent
> = {
  active: 'success',
  expiring_soon: 'warning',
  expired: 'error',
};

export const LICENSE_STATUS_TO_SEMANTIC_INTENT: Record<
  LicensePresentationStatus,
  SemanticStatusIntent
> = {
  active: 'success',
  revoked: 'error',
  expired: 'error',
};

export const SEMANTIC_INTENT_TO_COLOR_TOKEN: Record<SemanticStatusIntent, string> = {
  success: 'var(--botmox-color-status-success)',
  warning: 'var(--botmox-color-status-warning)',
  error: 'var(--botmox-color-status-danger)',
  info: 'var(--botmox-color-status-info)',
  default: 'var(--botmox-color-status-neutral)',
};

export const getBotStatusIntent = (status: BotPresentationStatus): SemanticStatusIntent =>
  BOT_STATUS_TO_SEMANTIC_INTENT[status];

export const getSubscriptionStatusIntent = (
  status: SubscriptionPresentationStatus,
): SemanticStatusIntent => SUBSCRIPTION_STATUS_TO_SEMANTIC_INTENT[status];

export const getLicenseStatusIntent = (status: LicensePresentationStatus): SemanticStatusIntent =>
  LICENSE_STATUS_TO_SEMANTIC_INTENT[status];

export const getSemanticIntentColorToken = (intent: SemanticStatusIntent): string =>
  SEMANTIC_INTENT_TO_COLOR_TOKEN[intent];

export const getRemainingDaysIntent = (daysRemaining: number): SemanticStatusIntent => {
  if (daysRemaining <= 3) {
    return 'error';
  }
  if (daysRemaining <= 7) {
    return 'warning';
  }
  return 'success';
};

export const getExpiryIntent = (
  expired: boolean,
  expiringSoon: boolean,
): SemanticStatusIntent | undefined => {
  if (expired) {
    return 'error';
  }
  if (expiringSoon) {
    return 'warning';
  }
  return undefined;
};
