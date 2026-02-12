import type { VMGeneratorSettings } from '../../../types';

export const updateSettingsByPath = (
  settings: VMGeneratorSettings,
  path: string,
  value: unknown
): VMGeneratorSettings => {
  const parts = path.split('.');
  const updated = { ...settings } as Record<string, unknown>;
  let obj: Record<string, unknown> = updated;

  for (let i = 0; i < parts.length - 1; i++) {
    obj[parts[i]] = { ...(obj[parts[i]] as Record<string, unknown>) };
    obj = obj[parts[i]] as Record<string, unknown>;
  }

  obj[parts[parts.length - 1]] = value;
  return updated as unknown as VMGeneratorSettings;
};

export const normalizeTemplateCores = (value: unknown): number | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return null;
  return Math.max(1, Math.trunc(parsed));
};

export const normalizeTemplateMemoryMb = (value: unknown): number | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  const mb = parsed <= 64 ? parsed * 1024 : parsed;
  if (!Number.isFinite(mb) || mb < 256) return null;
  return Math.max(256, Math.trunc(mb));
};
