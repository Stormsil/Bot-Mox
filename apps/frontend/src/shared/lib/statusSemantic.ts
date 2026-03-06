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

export type ProxyPresentationStatus = 'active' | 'expired' | 'banned';

export type StatusSemanticContract = Readonly<{
  BOT_STATUS_TO_SEMANTIC_INTENT: Readonly<Record<BotPresentationStatus, SemanticStatusIntent>>;
  SUBSCRIPTION_STATUS_TO_SEMANTIC_INTENT: Readonly<
    Record<SubscriptionPresentationStatus, SemanticStatusIntent>
  >;
  LICENSE_STATUS_TO_SEMANTIC_INTENT: Readonly<
    Record<LicensePresentationStatus, SemanticStatusIntent>
  >;
  PROXY_STATUS_TO_SEMANTIC_INTENT: Readonly<Record<ProxyPresentationStatus, SemanticStatusIntent>>;
  SEMANTIC_INTENT_TO_COLOR_TOKEN: Readonly<Record<SemanticStatusIntent, string>>;
  BOT_STATUS_TO_ICON_COLOR_TOKEN: Readonly<Record<BotPresentationStatus, string>>;
  SUBSCRIPTION_STATUS_TO_TEXT: Readonly<Record<SubscriptionPresentationStatus, string>>;
}>;

export const STATUS_SEMANTIC_CONTRACT_VERSION = 'v1' as const;

export const STATUS_SEMANTIC_CONTRACT_BASELINE = Object.freeze({
  version: STATUS_SEMANTIC_CONTRACT_VERSION,
  contractKeys: Object.freeze([
    'BOT_STATUS_TO_SEMANTIC_INTENT',
    'SUBSCRIPTION_STATUS_TO_SEMANTIC_INTENT',
    'LICENSE_STATUS_TO_SEMANTIC_INTENT',
    'PROXY_STATUS_TO_SEMANTIC_INTENT',
    'SEMANTIC_INTENT_TO_COLOR_TOKEN',
    'BOT_STATUS_TO_ICON_COLOR_TOKEN',
    'SUBSCRIPTION_STATUS_TO_TEXT',
  ] as const satisfies readonly (keyof StatusSemanticContract)[]),
  duplicationBaseline: Object.freeze({
    statusToIntentMapCount: 4,
    statusIntentHelperCount: 9,
    semanticIntentCount: 5,
  }),
});

export const BOT_STATUS_TO_SEMANTIC_INTENT = Object.freeze({
  offline: 'default',
  prepare: 'info',
  leveling: 'info',
  profession: 'warning',
  farming: 'success',
  banned: 'error',
} as const satisfies Record<BotPresentationStatus, SemanticStatusIntent>);

export const SUBSCRIPTION_STATUS_TO_SEMANTIC_INTENT = Object.freeze({
  active: 'success',
  expiring_soon: 'warning',
  expired: 'error',
} as const satisfies Record<SubscriptionPresentationStatus, SemanticStatusIntent>);

export const LICENSE_STATUS_TO_SEMANTIC_INTENT = Object.freeze({
  active: 'success',
  revoked: 'error',
  expired: 'error',
} as const satisfies Record<LicensePresentationStatus, SemanticStatusIntent>);

export const PROXY_STATUS_TO_SEMANTIC_INTENT = Object.freeze({
  active: 'success',
  expired: 'error',
  banned: 'error',
} as const satisfies Record<ProxyPresentationStatus, SemanticStatusIntent>);

export const SEMANTIC_INTENT_TO_COLOR_TOKEN = Object.freeze({
  success: 'var(--botmox-color-status-success)',
  warning: 'var(--botmox-color-status-warning)',
  error: 'var(--botmox-color-status-danger)',
  info: 'var(--botmox-color-status-info)',
  default: 'var(--botmox-color-status-neutral)',
} as const satisfies Record<SemanticStatusIntent, string>);

export const BOT_STATUS_TO_ICON_COLOR_TOKEN = Object.freeze({
  offline: 'var(--botmox-color-status-neutral)',
  prepare: 'var(--botmox-color-status-info)',
  leveling: 'var(--botmox-color-brand-primary)',
  profession: 'var(--botmox-color-brand-warning)',
  farming: 'var(--botmox-color-status-success)',
  banned: 'var(--botmox-color-status-danger)',
} as const satisfies Record<BotPresentationStatus, string>);

export const SUBSCRIPTION_STATUS_TO_TEXT = Object.freeze({
  active: 'Active',
  expiring_soon: 'Expiring Soon',
  expired: 'Expired',
} as const satisfies Record<SubscriptionPresentationStatus, string>);

export const STATUS_SEMANTIC_CONTRACT: StatusSemanticContract = Object.freeze({
  BOT_STATUS_TO_SEMANTIC_INTENT,
  SUBSCRIPTION_STATUS_TO_SEMANTIC_INTENT,
  LICENSE_STATUS_TO_SEMANTIC_INTENT,
  PROXY_STATUS_TO_SEMANTIC_INTENT,
  SEMANTIC_INTENT_TO_COLOR_TOKEN,
  BOT_STATUS_TO_ICON_COLOR_TOKEN,
  SUBSCRIPTION_STATUS_TO_TEXT,
});

export const getBotStatusIntent = (status: BotPresentationStatus): SemanticStatusIntent =>
  BOT_STATUS_TO_SEMANTIC_INTENT[status];

export const getSubscriptionStatusIntent = (
  status: SubscriptionPresentationStatus,
): SemanticStatusIntent => SUBSCRIPTION_STATUS_TO_SEMANTIC_INTENT[status];

export const getLicenseStatusIntent = (status: LicensePresentationStatus): SemanticStatusIntent =>
  LICENSE_STATUS_TO_SEMANTIC_INTENT[status];

export const getProxyStatusIntent = (status: ProxyPresentationStatus): SemanticStatusIntent =>
  PROXY_STATUS_TO_SEMANTIC_INTENT[status];

export const isProxyPresentationStatus = (status: string): status is ProxyPresentationStatus =>
  Object.hasOwn(PROXY_STATUS_TO_SEMANTIC_INTENT, status);

export const getSemanticIntentColorToken = (intent: SemanticStatusIntent): string =>
  SEMANTIC_INTENT_TO_COLOR_TOKEN[intent];

export const getBotStatusIconColorToken = (status: BotPresentationStatus): string =>
  BOT_STATUS_TO_ICON_COLOR_TOKEN[status];

export const getSubscriptionStatusText = (status: SubscriptionPresentationStatus): string =>
  SUBSCRIPTION_STATUS_TO_TEXT[status];

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
