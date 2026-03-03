export type ResourceComputedStatus = 'active' | 'expiring' | 'expiring_soon' | 'expired' | 'banned';

export type ResourceStatusVocabularyInput = {
  computed_status?: unknown;
  status?: unknown;
  days_remaining?: unknown;
  is_expiring_soon?: unknown;
};

export type NormalizedResourceStatusVocabulary = {
  computedStatus?: Exclude<ResourceComputedStatus, 'expiring_soon'>;
  rawComputedStatus?: ResourceComputedStatus;
  statusToken?: string;
  daysRemaining?: number;
  isExpiringSoon: boolean;
};

const RESOURCE_COMPUTED_STATUS_SET = new Set<ResourceComputedStatus>([
  'active',
  'expiring',
  'expiring_soon',
  'expired',
  'banned',
]);

function toToken(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function toNonNegativeInt(value: unknown): number | undefined {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return undefined;
  }
  return Math.max(0, Math.ceil(numeric));
}

export function toResourceComputedStatus(value: unknown): ResourceComputedStatus | undefined {
  const token = toToken(value);
  return RESOURCE_COMPUTED_STATUS_SET.has(token as ResourceComputedStatus)
    ? (token as ResourceComputedStatus)
    : undefined;
}

export function normalizeResourceStatusVocabulary(
  value: ResourceStatusVocabularyInput | undefined,
): NormalizedResourceStatusVocabulary {
  const rawComputedStatus = toResourceComputedStatus(value?.computed_status);
  const computedStatus =
    rawComputedStatus === 'expiring_soon'
      ? 'expiring'
      : (rawComputedStatus as Exclude<ResourceComputedStatus, 'expiring_soon'> | undefined);
  const statusToken = toToken(value?.status);
  const daysRemaining = toNonNegativeInt(value?.days_remaining);
  const isExpiringSoon =
    value?.is_expiring_soon === true ||
    rawComputedStatus === 'expiring_soon' ||
    computedStatus === 'expiring';

  return {
    computedStatus,
    rawComputedStatus,
    statusToken: statusToken || undefined,
    daysRemaining,
    isExpiringSoon,
  };
}
