import type { MenuProps } from 'antd';
import { normalizeResourceStatusVocabulary } from '../../../../entities/resources/model/statusVocabulary';
import type { BotLicense } from '../../../../entities/resources/model/types';
import type { LicenseFormValues, LicenseInfo } from './types';

export const withLicenseRuntimeState = (license: BotLicense): LicenseInfo => {
  const normalizedStatus = normalizeResourceStatusVocabulary(license);
  const isExpired =
    normalizedStatus.computedStatus === 'expired' || normalizedStatus.statusToken === 'expired';

  return {
    ...license,
    daysRemaining: isExpired ? 0 : (normalizedStatus.daysRemaining ?? 0),
    isExpired,
    isExpiringSoon: normalizedStatus.isExpiringSoon,
  };
};

export const getAvailableLicenses = (licenses: LicenseInfo[], botId: string) =>
  licenses.filter((license) => !license.bot_ids?.includes(botId));

export const getLicenseStatusColor = (license: LicenseInfo) => {
  if (license.isExpired) return 'error';
  if (license.isExpiringSoon) return 'warning';
  return 'success';
};

export const getLicenseStatusText = (license: LicenseInfo) => {
  if (license.isExpired) return 'Expired';
  if (license.isExpiringSoon) return `Expiring in ${license.daysRemaining} days`;
  return 'Active';
};

export const getDaysLeftColor = (license: LicenseInfo) => {
  if (license.isExpired) return 'var(--botmox-color-status-danger)';
  if (license.isExpiringSoon) return 'var(--botmox-color-status-warning)';
  return 'var(--botmox-color-status-success)';
};

export const getTypeOptions = (licenses: LicenseInfo[]) =>
  Array.from(new Set(licenses.map((license) => license.type).filter(Boolean))).map((type) => ({
    value: type,
    label: type,
  }));

export const buildAddMenuItems = (availableCount: number): MenuProps['items'] => [
  { key: 'create', label: 'Create new license' },
  { key: 'assign', label: 'Assign existing license', disabled: availableCount === 0 },
];

export const buildLicensePayload = (
  values: LicenseFormValues,
  botIds: string[],
  now = Date.now(),
) => {
  const expiresAt = values.expires_at.valueOf();
  const status: BotLicense['status'] = now > expiresAt ? 'expired' : 'active';

  return {
    key: values.key,
    type: values.type,
    status,
    bot_ids: botIds,
    expires_at: expiresAt,
    updated_at: now,
  };
};
