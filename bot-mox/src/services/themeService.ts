import { apiGet, apiPut } from './apiClient';
import { uiLogger } from '../observability/uiLogger'
import {
  DEFAULT_THEME_VISUAL_SETTINGS,
  DEFAULT_THEME_SHAPE_SETTINGS,
  DEFAULT_THEME_TYPOGRAPHY_SETTINGS,
  createDefaultThemePalettes,
  sanitizeThemePalettes,
  sanitizeThemeShapeSettings,
  sanitizeThemeTypographySettings,
  sanitizeThemeVisualSettings,
  type ThemeMode,
  type ThemePalette,
  type ThemePalettes,
  type ThemeShapeSettings,
  type ThemeTypographySettings,
  type ThemeVisualSettings,
} from '../theme/themePalette';

const THEME_SETTINGS_PATH = '/api/v1/settings/theme';

export interface ThemePreset {
  id: string;
  name: string;
  palettes: ThemePalettes;
  created_at: number;
  updated_at: number;
}

export interface ThemeSettings {
  palettes: ThemePalettes;
  presets: Record<string, ThemePreset>;
  active_preset_id?: string;
  visual: ThemeVisualSettings;
  typography: ThemeTypographySettings;
  shape: ThemeShapeSettings;
  updated_at: number;
  updated_by?: string;
}

export const getDefaultThemeSettings = (): ThemeSettings => ({
  palettes: createDefaultThemePalettes(),
  presets: {},
  visual: { ...DEFAULT_THEME_VISUAL_SETTINGS },
  typography: { ...DEFAULT_THEME_TYPOGRAPHY_SETTINGS },
  shape: { ...DEFAULT_THEME_SHAPE_SETTINGS },
  updated_at: Date.now(),
});

const toSafePresetName = (value: unknown, fallback: string): string => {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : fallback;
};

const sanitizeThemePresets = (source: unknown): Record<string, ThemePreset> => {
  const payload = (source ?? {}) as Record<string, unknown>;
  const presets: Record<string, ThemePreset> = {};
  const timestamp = Date.now();

  for (const [presetId, rawPreset] of Object.entries(payload)) {
    const preset = (rawPreset ?? {}) as Record<string, unknown>;
    const id = toSafePresetName(preset.id, presetId);
    if (!id) continue;

    const fallbackName = `Theme ${id.slice(0, 6)}`;
    presets[id] = {
      id,
      name: toSafePresetName(preset.name, fallbackName),
      palettes: sanitizeThemePalettes(preset.palettes),
      created_at: typeof preset.created_at === 'number' ? preset.created_at : timestamp,
      updated_at: typeof preset.updated_at === 'number' ? preset.updated_at : timestamp,
    };
  }

  return presets;
};

const createPresetId = (name: string): string => {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  const suffix = Date.now().toString(36);
  return normalized ? `${normalized}-${suffix}` : `theme-${suffix}`;
};

export const getThemeSettings = async (): Promise<ThemeSettings> => {
  try {
    const response = await apiGet<unknown>(THEME_SETTINGS_PATH);
    const rawData = response.data;

    if (!rawData || typeof rawData !== 'object') {
      return getDefaultThemeSettings();
    }

    const value = rawData as {
      palettes?: unknown;
      presets?: unknown;
      active_preset_id?: unknown;
      visual?: unknown;
      typography?: unknown;
      shape?: unknown;
      updated_at?: unknown;
      updated_by?: unknown;
    };
    const presets = sanitizeThemePresets(value.presets);
    const activePresetId =
      typeof value.active_preset_id === 'string' && presets[value.active_preset_id]
        ? value.active_preset_id
        : undefined;

    return {
      palettes: sanitizeThemePalettes(value.palettes),
      presets,
      active_preset_id: activePresetId,
      visual: sanitizeThemeVisualSettings(value.visual),
      typography: sanitizeThemeTypographySettings(value.typography),
      shape: sanitizeThemeShapeSettings(value.shape),
      updated_at: typeof value.updated_at === 'number' ? value.updated_at : Date.now(),
      updated_by: typeof value.updated_by === 'string' ? value.updated_by : undefined,
    };
  } catch (error) {
    uiLogger.error('Error loading theme settings:', error);
    return getDefaultThemeSettings();
  }
};

export const updateThemeSettings = async (
  palettes: ThemePalettes,
  userId?: string,
  activePresetId?: string,
  options?: { syncActivePreset?: boolean },
  visualSettings?: ThemeVisualSettings,
  typographySettings?: ThemeTypographySettings,
  shapeSettings?: ThemeShapeSettings
): Promise<void> => {
  const current = await getThemeSettings();

  const nextActivePresetId =
    activePresetId === undefined
      ? current.active_preset_id
      : activePresetId && current.presets[activePresetId]
        ? activePresetId
        : undefined;

  const normalizedPalettes = sanitizeThemePalettes(palettes);
  const nextPresets = { ...current.presets };

  if (options?.syncActivePreset && nextActivePresetId && nextPresets[nextActivePresetId]) {
    nextPresets[nextActivePresetId] = {
      ...nextPresets[nextActivePresetId],
      palettes: normalizedPalettes,
      updated_at: Date.now(),
    };
  }

  const payload: ThemeSettings = {
    palettes: normalizedPalettes,
    presets: nextPresets,
    active_preset_id: nextActivePresetId,
    visual: sanitizeThemeVisualSettings(visualSettings ?? current.visual),
    typography: sanitizeThemeTypographySettings(typographySettings ?? current.typography),
    shape: sanitizeThemeShapeSettings(shapeSettings ?? current.shape),
    updated_at: Date.now(),
  };

  if (userId) {
    payload.updated_by = userId;
  }

  await apiPut(THEME_SETTINGS_PATH, payload);
};

export const updateThemePalette = async (
  mode: ThemeMode,
  palette: ThemePalette,
  userId?: string
): Promise<void> => {
  const current = await getThemeSettings();
  await updateThemeSettings(
    {
      ...current.palettes,
      [mode]: palette,
    },
    userId,
    current.active_preset_id,
    undefined,
    current.visual,
    current.typography,
    current.shape
  );
};

export const updateThemeVisualSettings = async (
  visual: ThemeVisualSettings,
  userId?: string
): Promise<void> => {
  const current = await getThemeSettings();
  await updateThemeSettings(
    current.palettes,
    userId,
    current.active_preset_id,
    undefined,
    visual,
    current.typography,
    current.shape
  );
};

export const saveThemePreset = async (
  name: string,
  palettes: ThemePalettes,
  userId?: string
): Promise<ThemePreset> => {
  const normalizedName = name.trim();
  if (!normalizedName) {
    throw new Error('Theme name is required');
  }

  const current = await getThemeSettings();
  const timestamp = Date.now();
  const presetId = createPresetId(normalizedName);

  const preset: ThemePreset = {
    id: presetId,
    name: normalizedName,
    palettes: sanitizeThemePalettes(palettes),
    created_at: timestamp,
    updated_at: timestamp,
  };

  const payload: ThemeSettings = {
    palettes: sanitizeThemePalettes(palettes),
    presets: {
      ...current.presets,
      [preset.id]: preset,
    },
    active_preset_id: preset.id,
    visual: current.visual,
    typography: current.typography,
    shape: current.shape,
    updated_at: timestamp,
  };

  if (userId) {
    payload.updated_by = userId;
  }

  await apiPut(THEME_SETTINGS_PATH, payload);
  return preset;
};

export const applyThemePreset = async (
  presetId: string,
  userId?: string
): Promise<ThemeSettings> => {
  const current = await getThemeSettings();
  const preset = current.presets[presetId];

  if (!preset) {
    throw new Error('Theme preset not found');
  }

  const payload: ThemeSettings = {
    palettes: sanitizeThemePalettes(preset.palettes),
    presets: current.presets,
    active_preset_id: preset.id,
    visual: current.visual,
    typography: current.typography,
    shape: current.shape,
    updated_at: Date.now(),
  };

  if (userId) {
    payload.updated_by = userId;
  }

  await apiPut(THEME_SETTINGS_PATH, payload);
  return payload;
};

export const deleteThemePreset = async (
  presetId: string,
  userId?: string
): Promise<ThemeSettings> => {
  const current = await getThemeSettings();

  if (!current.presets[presetId]) {
    return current;
  }

  const restPresets = { ...current.presets };
  delete restPresets[presetId];
  const nextActivePresetId =
    current.active_preset_id === presetId ? undefined : current.active_preset_id;

  const payload: ThemeSettings = {
    palettes: current.palettes,
    presets: restPresets,
    active_preset_id: nextActivePresetId,
    visual: current.visual,
    typography: current.typography,
    shape: current.shape,
    updated_at: Date.now(),
  };

  if (userId) {
    payload.updated_by = userId;
  }

  await apiPut(THEME_SETTINGS_PATH, payload);
  return payload;
};
