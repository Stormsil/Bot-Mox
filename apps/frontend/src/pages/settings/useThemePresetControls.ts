import { message } from 'antd';
import { type Dispatch, type SetStateAction, useCallback, useMemo, useState } from 'react';
import { cloneThemePalettes, mapThemePresetsToList } from './themeSettings.helpers';
import type {
  ThemePalettes,
  ThemePreset,
  ThemeSettings,
  ThemeShapeSettings,
  ThemeTypographySettings,
  ThemeVisualSettings,
} from './themeSettings.types';

interface UseThemePresetControlsParams {
  savePreset: (
    payload: { name: string; palettes: ThemePalettes },
    options?: {
      onSuccess?: (preset: ThemePreset) => void;
      onSettled?: () => void;
    },
  ) => void;
  applyPreset: (
    payload: { presetId: string },
    options?: {
      onSuccess?: (settings: ThemeSettings) => void;
      onSettled?: () => void;
    },
  ) => void;
  deletePreset: (
    payload: { presetId: string },
    options?: {
      onSuccess?: (settings: ThemeSettings) => void;
      onSettled?: () => void;
    },
  ) => void;
  themePresetSaving: boolean;
  themePresetApplying: boolean;
  themePresetDeleting: boolean;
  localThemePalettes: ThemePalettes;
  sanitizeVisualSettings: (source: unknown) => ThemeVisualSettings;
  sanitizeTypographySettings: (source: unknown) => ThemeTypographySettings;
  sanitizeShapeSettings: (source: unknown) => ThemeShapeSettings;
  setLocalThemePalettes: (value: ThemePalettes) => void;
  setThemeInputValues: (value: ThemePalettes) => void;
  setLocalVisualSettings: (value: ThemeVisualSettings) => void;
  setLocalTypographySettings: (value: ThemeTypographySettings) => void;
  setLocalShapeSettings: (value: ThemeShapeSettings) => void;
  onThemePalettesChange?: (palettes: ThemePalettes) => void;
  onVisualSettingsChange?: (settings: ThemeVisualSettings) => void;
  onTypographySettingsChange?: (settings: ThemeTypographySettings) => void;
  onShapeSettingsChange?: (settings: ThemeShapeSettings) => void;
}

interface UseThemePresetControlsResult {
  themePresetSaving: boolean;
  themePresetApplying: boolean;
  themePresetDeleting: boolean;
  themePresets: ThemePreset[];
  setThemePresets: Dispatch<SetStateAction<ThemePreset[]>>;
  selectedPresetId?: string;
  setSelectedPresetId: Dispatch<SetStateAction<string | undefined>>;
  activePresetId?: string;
  setActivePresetId: Dispatch<SetStateAction<string | undefined>>;
  newThemePresetName: string;
  setNewThemePresetName: (name: string) => void;
  themePresetOptions: Array<{ label: string; value: string }>;
  handleSaveCurrentAsPreset: () => Promise<void>;
  handleApplySelectedPreset: () => Promise<void>;
  handleDeleteSelectedPreset: () => Promise<void>;
}

export function useThemePresetControls(
  params: UseThemePresetControlsParams,
): UseThemePresetControlsResult {
  const [themePresets, setThemePresets] = useState<ThemePreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string | undefined>();
  const [activePresetId, setActivePresetId] = useState<string | undefined>();
  const [newThemePresetName, setNewThemePresetName] = useState('');

  const handleSaveCurrentAsPreset = useCallback(async () => {
    const presetName = newThemePresetName.trim();
    if (!presetName) {
      message.warning('Enter theme name first');
      return;
    }

    await new Promise<void>((resolve) => {
      params.savePreset(
        {
          name: presetName,
          palettes: params.localThemePalettes,
        },
        {
          onSuccess: (preset) => {
            setThemePresets((current) =>
              mapThemePresetsToList({
                ...Object.fromEntries(current.map((item) => [item.id, item])),
                [preset.id]: preset,
              }),
            );
            setSelectedPresetId(preset.id);
            setActivePresetId(preset.id);
            setNewThemePresetName('');
          },
          onSettled: () => resolve(),
        },
      );
    });
  }, [newThemePresetName, params.localThemePalettes, params.savePreset]);

  const handleApplySelectedPreset = useCallback(async () => {
    if (!selectedPresetId) {
      message.warning('Select saved theme first');
      return;
    }

    await new Promise<void>((resolve) => {
      params.applyPreset(
        { presetId: selectedPresetId },
        {
          onSuccess: (nextSettings) => {
            const nextPalettes = cloneThemePalettes(nextSettings.palettes);
            const nextVisual = params.sanitizeVisualSettings(nextSettings.visual);
            const nextTypography = params.sanitizeTypographySettings(nextSettings.typography);
            const nextShape = params.sanitizeShapeSettings(nextSettings.shape);

            params.setLocalThemePalettes(nextPalettes);
            params.setThemeInputValues(nextPalettes);
            params.setLocalVisualSettings(nextVisual);
            params.setLocalTypographySettings(nextTypography);
            params.setLocalShapeSettings(nextShape);
            setThemePresets(mapThemePresetsToList(nextSettings.presets));
            setActivePresetId(nextSettings.active_preset_id);
            setSelectedPresetId(nextSettings.active_preset_id ?? selectedPresetId);
            params.onThemePalettesChange?.(nextSettings.palettes);
            params.onVisualSettingsChange?.(nextVisual);
            params.onTypographySettingsChange?.(nextTypography);
            params.onShapeSettingsChange?.(nextShape);
          },
          onSettled: () => resolve(),
        },
      );
    });
  }, [params, selectedPresetId]);

  const handleDeleteSelectedPreset = useCallback(async () => {
    if (!selectedPresetId) {
      return;
    }

    await new Promise<void>((resolve) => {
      params.deletePreset(
        { presetId: selectedPresetId },
        {
          onSuccess: (nextSettings) => {
            const nextPresets = mapThemePresetsToList(nextSettings.presets);
            const nextTypography = params.sanitizeTypographySettings(nextSettings.typography);
            const nextShape = params.sanitizeShapeSettings(nextSettings.shape);

            setThemePresets(nextPresets);
            setActivePresetId(nextSettings.active_preset_id);
            setSelectedPresetId(nextSettings.active_preset_id ?? nextPresets[0]?.id);
            params.setLocalTypographySettings(nextTypography);
            params.setLocalShapeSettings(nextShape);
            params.onTypographySettingsChange?.(nextTypography);
            params.onShapeSettingsChange?.(nextShape);
          },
          onSettled: () => resolve(),
        },
      );
    });
  }, [params, selectedPresetId]);

  const themePresetOptions = useMemo(
    () =>
      themePresets.map((preset) => ({
        label: preset.id === activePresetId ? `${preset.name} (active)` : preset.name,
        value: preset.id,
      })),
    [activePresetId, themePresets],
  );

  return {
    themePresetSaving: params.themePresetSaving,
    themePresetApplying: params.themePresetApplying,
    themePresetDeleting: params.themePresetDeleting,
    themePresets,
    setThemePresets,
    selectedPresetId,
    setSelectedPresetId,
    activePresetId,
    setActivePresetId,
    newThemePresetName,
    setNewThemePresetName,
    themePresetOptions,
    handleSaveCurrentAsPreset,
    handleApplySelectedPreset,
    handleDeleteSelectedPreset,
  };
}
