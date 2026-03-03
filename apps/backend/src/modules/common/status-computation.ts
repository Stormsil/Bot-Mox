const OFFLINE_THRESHOLD_MS = 5 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_WARNING_DAYS = 7;

type UnknownRecord = Record<string, unknown>;
type ResourceKind = 'licenses' | 'proxies' | 'subscriptions';

export type ComputedStatusFields = {
  computed_status: string;
  days_remaining: number | null;
  is_expiring_soon: boolean;
};

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function computeDaysRemaining(expiresAt: number, nowMs: number): number {
  return Math.ceil((expiresAt - nowMs) / ONE_DAY_MS);
}

export function buildBotComputedStatusFields(
  record: UnknownRecord,
  nowMs: number = Date.now(),
): ComputedStatusFields {
  const rawStatus = record.status;
  const status = typeof rawStatus === 'string' ? rawStatus : '';

  if (status === 'banned') {
    return {
      computed_status: 'banned',
      days_remaining: null,
      is_expiring_soon: false,
    };
  }

  const lastSeen = toFiniteNumber(record.last_seen);
  if (lastSeen !== null && lastSeen > 0 && nowMs - lastSeen > OFFLINE_THRESHOLD_MS) {
    return {
      computed_status: 'offline',
      days_remaining: null,
      is_expiring_soon: false,
    };
  }

  return {
    computed_status: status || 'offline',
    days_remaining: null,
    is_expiring_soon: false,
  };
}

function buildProxyComputedStatusFields(
  record: UnknownRecord,
  nowMs: number,
): ComputedStatusFields {
  const status = typeof record.status === 'string' ? record.status : '';
  if (status === 'banned') {
    return {
      computed_status: 'banned',
      days_remaining: 0,
      is_expiring_soon: false,
    };
  }

  const expiresAt = toFiniteNumber(record.expires_at);
  const isExpiredByDate = expiresAt !== null ? nowMs > expiresAt : false;
  const daysRemaining = expiresAt !== null ? computeDaysRemaining(expiresAt, nowMs) : 0;

  if (isExpiredByDate || status === 'expired') {
    return {
      computed_status: 'expired',
      days_remaining: 0,
      is_expiring_soon: false,
    };
  }

  const isExpiringSoon = daysRemaining <= DEFAULT_WARNING_DAYS && daysRemaining > 0;
  if (isExpiringSoon) {
    return {
      computed_status: 'expiring',
      days_remaining: daysRemaining,
      is_expiring_soon: true,
    };
  }

  return {
    computed_status: 'active',
    days_remaining: daysRemaining,
    is_expiring_soon: false,
  };
}

function buildTimedResourceComputedStatusFields(
  record: UnknownRecord,
  nowMs: number,
  warningDays: number,
): ComputedStatusFields {
  const expiresAt = toFiniteNumber(record.expires_at);
  if (expiresAt === null) {
    return {
      computed_status: 'active',
      days_remaining: null,
      is_expiring_soon: false,
    };
  }

  const daysRemaining = computeDaysRemaining(expiresAt, nowMs);
  if (nowMs > expiresAt) {
    return {
      computed_status: 'expired',
      days_remaining: 0,
      is_expiring_soon: false,
    };
  }

  if (daysRemaining <= warningDays && daysRemaining > 0) {
    return {
      computed_status: 'expiring',
      days_remaining: Math.max(0, daysRemaining),
      is_expiring_soon: true,
    };
  }

  return {
    computed_status: 'active',
    days_remaining: Math.max(0, daysRemaining),
    is_expiring_soon: false,
  };
}

export function buildResourceComputedStatusFields(
  kind: ResourceKind,
  record: UnknownRecord,
  nowMs: number = Date.now(),
  warningDays: number = DEFAULT_WARNING_DAYS,
): ComputedStatusFields {
  if (kind === 'proxies') {
    return buildProxyComputedStatusFields(record, nowMs);
  }

  return buildTimedResourceComputedStatusFields(record, nowMs, warningDays);
}
