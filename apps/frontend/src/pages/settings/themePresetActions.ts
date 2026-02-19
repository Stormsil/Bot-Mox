import { message } from 'antd';
import type { Dispatch, SetStateAction } from 'react';
import { uiLogger } from '../../observability/uiLogger';
import { cloneThemePalettes, mapThemePresetsToList } from './themeSettings.helpers';
import type {
  ThemePalettes,
  ThemePreset,
  ThemeSettings,
  ThemeShapeSettings,
  ThemeTypographySettings,
  ThemeVisualSettings,
} from './themeSettings.types';

interface SavePresetParams {
  newThemePresetName: string;
  localThemePalettes: ThemePalettes;
  savePreset: (payload: { name: string; palettes: ThemePalettes }) => Promise<ThemePreset>;
  setThemePresets: Dispatch<SetStateAction<ThemePreset[]>>;
  setSelectedPresetId: (value: string | undefined) => void;
  setActivePresetId: (value: string | undefined) => void;
  setNewThemePresetName: (value: string) => void;
}

interface ApplyPresetParams {
  selectedPresetId?: string;
  applyPreset: (payload: { presetId: string }) => Promise<ThemeSettings>;
  sanitizeVisualSettings: (source: unknown) => ThemeVisualSettings;
  sanitizeTypographySettings: (source: unknown) => ThemeTypographySettings;
  sanitizeShapeSettings: (source: unknown) => ThemeShapeSettings;
  setLocalThemePalettes: (value: ThemePalettes) => void;
  setThemeInputValues: (value: ThemePalettes) => void;
  setLocalVisualSettings: (value: ThemeVisualSettings) => void;
  setLocalTypographySettings: (value: ThemeTypographySettings) => void;
  setLocalShapeSettings: (value: ThemeShapeSettings) => void;
  setThemePresets: (value: ThemePreset[]) => void;
  setActivePresetId: (value: string | undefined) => void;
  setSelectedPresetId: (value: string | undefined) => void;
  onThemePalettesChange?: (palettes: ThemePalettes) => void;
  onVisualSettingsChange?: (settings: ThemeVisualSettings) => void;
  onTypographySettingsChange?: (settings: ThemeTypographySettings) => void;
  onShapeSettingsChange?: (settings: ThemeShapeSettings) => void;
}

interface DeletePresetParams {
  selectedPresetId?: string;
  deletePreset: (payload: { presetId: string }) => Promise<ThemeSettings>;
  sanitizeTypographySettings: (source: unknown) => ThemeTypographySettings;
  sanitizeShapeSettings: (source: unknown) => ThemeShapeSettings;
  setThemePresets: (value: ThemePreset[]) => void;
  setActivePresetId: (value: string | undefined) => void;
  setSelectedPresetId: (value: string | undefined) => void;
  setLocalTypographySettings: (value: ThemeTypographySettings) => void;
  setLocalShapeSettings: (value: ThemeShapeSettings) => void;
  onTypographySettingsChange?: (settings: ThemeTypographySettings) => void;
  onShapeSettingsChange?: (settings: ThemeShapeSettings) => void;
}

export async function saveCurrentThemePreset(params: SavePresetParams): Promise<boolean> {
  const presetName = params.newThemePresetName.trim();
  if (!presetName) {
    message.warning('Enter theme name first');
    return false;
  }

  try {
    const preset = await params.savePreset({
      name: presetName,
      palettes: params.localThemePalettes,
    });

    params.setThemePresets((current) =>
      mapThemePresetsToList({
        ...Object.fromEntries(current.map((item) => [item.id, item])),
        [preset.id]: preset,
      }),
    );
    params.setSelectedPresetId(preset.id);
    params.setActivePresetId(preset.id);
    params.setNewThemePresetName('');
    message.success(`Theme "${preset.name}" saved`);
    return true;
  } catch (error) {
    uiLogger.error('Error saving theme preset:', error);
    message.error('Failed to save theme preset');
    return false;
  }
}

export async function applySelectedThemePreset(params: ApplyPresetParams): Promise<boolean> {
  if (!params.selectedPresetId) {
    message.warning('Select saved theme first');
    return false;
  }

  try {
    const nextSettings = await params.applyPreset({ presetId: params.selectedPresetId });
    const nextPalettes = cloneThemePalettes(nextSettings.palettes);
    const nextVisual = params.sanitizeVisualSettings(nextSettings.visual);
    const nextTypography = params.sanitizeTypographySettings(nextSettings.typography);
    const nextShape = params.sanitizeShapeSettings(nextSettings.shape);

    params.setLocalThemePalettes(nextPalettes);
    params.setThemeInputValues(nextPalettes);
    params.setLocalVisualSettings(nextVisual);
    params.setLocalTypographySettings(nextTypography);
    params.setLocalShapeSettings(nextShape);
    params.setThemePresets(mapThemePresetsToList(nextSettings.presets));
    params.setActivePresetId(nextSettings.active_preset_id);
    params.setSelectedPresetId(nextSettings.active_preset_id ?? params.selectedPresetId);
    params.onThemePalettesChange?.(nextSettings.palettes);
    params.onVisualSettingsChange?.(nextVisual);
    params.onTypographySettingsChange?.(nextTypography);
    params.onShapeSettingsChange?.(nextShape);
    message.success('Theme applied');
    return true;
  } catch (error) {
    uiLogger.error('Error applying theme preset:', error);
    message.error('Failed to apply theme');
    return false;
  }
}

export async function deleteSelectedThemePreset(params: DeletePresetParams): Promise<boolean> {
  if (!params.selectedPresetId) {
    return false;
  }

  try {
    const nextSettings = await params.deletePreset({ presetId: params.selectedPresetId });
    const nextPresets = mapThemePresetsToList(nextSettings.presets);
    const nextTypography = params.sanitizeTypographySettings(nextSettings.typography);
    const nextShape = params.sanitizeShapeSettings(nextSettings.shape);

    params.setThemePresets(nextPresets);
    params.setActivePresetId(nextSettings.active_preset_id);
    params.setSelectedPresetId(nextSettings.active_preset_id ?? nextPresets[0]?.id);
    params.setLocalTypographySettings(nextTypography);
    params.setLocalShapeSettings(nextShape);
    params.onTypographySettingsChange?.(nextTypography);
    params.onShapeSettingsChange?.(nextShape);
    message.success('Theme preset deleted');
    return true;
  } catch (error) {
    uiLogger.error('Error deleting theme preset:', error);
    message.error('Failed to delete theme preset');
    return false;
  }
}
