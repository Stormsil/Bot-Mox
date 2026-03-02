import {
  normalizeHexColor,
  sanitizeThemeShapeSettings,
  sanitizeThemeTypographySettings,
  sanitizeThemeVisualSettings,
} from '../../theme/themePalette';
import { cloneThemePalettes, mapThemePresetsToList } from './themeSettings.helpers';
import type {
  ThemeBackgroundAsset,
  ThemeColorVariable,
  ThemeMode,
  ThemePalettes,
  ThemePreset,
  ThemeSettings,
  ThemeShapeSettings,
  ThemeTypographySettings,
  ThemeVisualSettings,
} from './themeSettings.types';

type SetState<T> = (value: T | ((current: T) => T)) => void;

export function applyThemeSettingsState(params: {
  settings: ThemeSettings;
  setLocalThemePalettes: (value: ThemePalettes) => void;
  setThemeInputValues: (value: ThemePalettes) => void;
  setThemePresets: (value: ThemePreset[]) => void;
  setActivePresetId: (value: string | undefined) => void;
  setSelectedPresetId: (value: string | undefined) => void;
  setLocalVisualSettings: (value: ThemeVisualSettings) => void;
  setLocalTypographySettings: (value: ThemeTypographySettings) => void;
  setLocalShapeSettings: (value: ThemeShapeSettings) => void;
  onThemePalettesChange?: ((palettes: ThemePalettes) => void) | undefined;
  onVisualSettingsChange?: ((settings: ThemeVisualSettings) => void) | undefined;
  onTypographySettingsChange?: ((settings: ThemeTypographySettings) => void) | undefined;
  onShapeSettingsChange?: ((settings: ThemeShapeSettings) => void) | undefined;
}): void {
  const nextPalettes = cloneThemePalettes(params.settings.palettes);
  const presets = mapThemePresetsToList(params.settings.presets);
  const nextVisual = sanitizeThemeVisualSettings(params.settings.visual);
  const nextTypography = sanitizeThemeTypographySettings(params.settings.typography);
  const nextShape = sanitizeThemeShapeSettings(params.settings.shape);

  params.setLocalThemePalettes(nextPalettes);
  params.setThemeInputValues(nextPalettes);
  params.setThemePresets(presets);
  params.setActivePresetId(params.settings.active_preset_id);
  params.setSelectedPresetId(params.settings.active_preset_id ?? presets[0]?.id);
  params.setLocalVisualSettings(nextVisual);
  params.setLocalTypographySettings(nextTypography);
  params.setLocalShapeSettings(nextShape);
  params.onThemePalettesChange?.(params.settings.palettes);
  params.onVisualSettingsChange?.(nextVisual);
  params.onTypographySettingsChange?.(nextTypography);
  params.onShapeSettingsChange?.(nextShape);
}

export function updateThemeColorState(params: {
  mode: ThemeMode;
  cssVar: ThemeColorVariable;
  rawColor: string;
  defaultThemePalettes: ThemePalettes;
  setLocalThemePalettes: SetState<ThemePalettes>;
  setThemeInputValues: SetState<ThemePalettes>;
  onThemePalettesChange?: ((palettes: ThemePalettes) => void) | undefined;
  shouldSyncApp: boolean;
}): void {
  const normalized = normalizeHexColor(
    params.rawColor,
    params.defaultThemePalettes[params.mode][params.cssVar],
  );

  params.setLocalThemePalettes((current) => {
    const next: ThemePalettes = {
      ...current,
      [params.mode]: {
        ...current[params.mode],
        [params.cssVar]: normalized,
      },
    };
    if (params.shouldSyncApp) {
      params.onThemePalettesChange?.(next);
    }
    return next;
  });

  params.setThemeInputValues((current) => ({
    ...current,
    [params.mode]: {
      ...current[params.mode],
      [params.cssVar]: normalized,
    },
  }));
}

export function resetCurrentPaletteState(params: {
  editingThemeMode: ThemeMode;
  defaultThemePalettes: ThemePalettes;
  setLocalThemePalettes: SetState<ThemePalettes>;
  setThemeInputValues: SetState<ThemePalettes>;
  onThemePalettesChange?: ((palettes: ThemePalettes) => void) | undefined;
}): void {
  const resetPalette = { ...params.defaultThemePalettes[params.editingThemeMode] };

  params.setLocalThemePalettes((current) => {
    const next: ThemePalettes = {
      ...current,
      [params.editingThemeMode]: resetPalette,
    };
    params.onThemePalettesChange?.(next);
    return next;
  });

  params.setThemeInputValues((current) => ({
    ...current,
    [params.editingThemeMode]: { ...resetPalette },
  }));
}

export async function saveThemeColorsAction(params: {
  updateThemeSettings: (payload: {
    palettes: ThemePalettes;
    activePresetId?: string;
    options: { syncActivePreset: true };
    visualSettings: ThemeVisualSettings;
    typographySettings: ThemeTypographySettings;
    shapeSettings: ThemeShapeSettings;
  }) => Promise<unknown>;
  localThemePalettes: ThemePalettes;
  activePresetId?: string;
  localVisualSettings: ThemeVisualSettings;
  localTypographySettings: ThemeTypographySettings;
  localShapeSettings: ThemeShapeSettings;
}): Promise<void> {
  await params.updateThemeSettings({
    palettes: params.localThemePalettes,
    activePresetId: params.activePresetId,
    options: { syncActivePreset: true },
    visualSettings: params.localVisualSettings,
    typographySettings: params.localTypographySettings,
    shapeSettings: params.localShapeSettings,
  });
}

export async function saveVisualSettingsAction(params: {
  updateVisualSettings: (payload: { visual: ThemeVisualSettings }) => Promise<unknown>;
  localVisualSettings: ThemeVisualSettings;
}): Promise<void> {
  await params.updateVisualSettings({ visual: params.localVisualSettings });
}

export async function refreshThemeAssetsAction(refetch: () => Promise<unknown>): Promise<void> {
  await refetch();
}

export async function uploadThemeAssetAction(params: {
  file: File;
  uploadAsset: (file: File) => Promise<ThemeBackgroundAsset>;
  setLocalVisualSettings: SetState<ThemeVisualSettings>;
  onVisualSettingsChange?: ((settings: ThemeVisualSettings) => void) | undefined;
}): Promise<void> {
  const uploaded = await params.uploadAsset(params.file);
  params.setLocalVisualSettings((current) => {
    const next = sanitizeThemeVisualSettings({
      ...current,
      enabled: true,
      mode: 'image',
      backgroundAssetId: uploaded.id,
      backgroundImageUrl: uploaded.image_url || undefined,
    });
    params.onVisualSettingsChange?.(next);
    return next;
  });
}

export function selectThemeBackgroundState(params: {
  assetId?: string;
  themeAssets: ThemeBackgroundAsset[];
  setLocalVisualSettings: SetState<ThemeVisualSettings>;
  onVisualSettingsChange?: ((settings: ThemeVisualSettings) => void) | undefined;
}): void {
  const selectedAsset = params.themeAssets.find((item) => item.id === params.assetId);
  params.setLocalVisualSettings((current) => {
    const next = sanitizeThemeVisualSettings({
      ...current,
      enabled: Boolean(params.assetId),
      mode: params.assetId ? 'image' : 'none',
      backgroundAssetId: params.assetId,
      backgroundImageUrl: selectedAsset?.image_url || undefined,
    });
    params.onVisualSettingsChange?.(next);
    return next;
  });
}

export async function deleteThemeAssetAction(params: {
  assetId: string;
  deleteAsset: (assetId: string) => Promise<unknown>;
  setLocalVisualSettings: SetState<ThemeVisualSettings>;
  onVisualSettingsChange?: ((settings: ThemeVisualSettings) => void) | undefined;
}): Promise<void> {
  await params.deleteAsset(params.assetId);
  params.setLocalVisualSettings((current) => {
    if (current.backgroundAssetId !== params.assetId) {
      return current;
    }
    const next = sanitizeThemeVisualSettings({
      ...current,
      enabled: false,
      mode: 'none',
      backgroundAssetId: undefined,
      backgroundImageUrl: undefined,
    });
    params.onVisualSettingsChange?.(next);
    return next;
  });
}
