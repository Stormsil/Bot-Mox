import type { MenuProps } from 'antd';
import type { BotLicense } from '../../../types';
import type { LicenseFormValues, LicenseInfo } from './types';

const DAY_MS = 1000 * 60 * 60 * 24;

export const withLicenseRuntimeState = (license: BotLicense): LicenseInfo => {
  const daysRemaining = Math.ceil((license.expires_at - Date.now()) / DAY_MS);
  return {
    ...license,
    daysRemaining,
    isExpired: Date.now() > license.expires_at,
    isExpiringSoon: daysRemaining <= 3 && daysRemaining > 0,
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
  if (license.isExpired) return '#ff4d4f';
  if (license.isExpiringSoon) return '#faad14';
  return '#52c41a';
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
