import { type Dispatch, type SetStateAction, useCallback, useMemo, useState } from 'react';
import {
  applySelectedThemePreset,
  deleteSelectedThemePreset,
  saveCurrentThemePreset,
} from './themePresetActions';
import type {
  ThemePalettes,
  ThemePreset,
  ThemeSettings,
  ThemeShapeSettings,
  ThemeTypographySettings,
  ThemeVisualSettings,
} from './themeSettings.types';

interface UseThemePresetControlsParams {
  savePreset: (payload: { name: string; palettes: ThemePalettes }) => Promise<ThemePreset>;
  applyPreset: (payload: { presetId: string }) => Promise<ThemeSettings>;
  deletePreset: (payload: { presetId: string }) => Promise<ThemeSettings>;
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
  const [themePresetSaving, setThemePresetSaving] = useState(false);
  const [themePresetApplying, setThemePresetApplying] = useState(false);
  const [themePresetDeleting, setThemePresetDeleting] = useState(false);
  const [themePresets, setThemePresets] = useState<ThemePreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string | undefined>();
  const [activePresetId, setActivePresetId] = useState<string | undefined>();
  const [newThemePresetName, setNewThemePresetName] = useState('');

  const handleSaveCurrentAsPreset = useCallback(async () => {
    setThemePresetSaving(true);
    try {
      await saveCurrentThemePreset({
        newThemePresetName,
        localThemePalettes: params.localThemePalettes,
        savePreset: params.savePreset,
        setThemePresets,
        setSelectedPresetId,
        setActivePresetId,
        setNewThemePresetName,
      });
    } finally {
      setThemePresetSaving(false);
    }
  }, [newThemePresetName, params.localThemePalettes, params.savePreset]);

  const handleApplySelectedPreset = useCallback(async () => {
    setThemePresetApplying(true);
    try {
      await applySelectedThemePreset({
        selectedPresetId,
        applyPreset: params.applyPreset,
        sanitizeVisualSettings: params.sanitizeVisualSettings,
        sanitizeTypographySettings: params.sanitizeTypographySettings,
        sanitizeShapeSettings: params.sanitizeShapeSettings,
        setLocalThemePalettes: params.setLocalThemePalettes,
        setThemeInputValues: params.setThemeInputValues,
        setLocalVisualSettings: params.setLocalVisualSettings,
        setLocalTypographySettings: params.setLocalTypographySettings,
        setLocalShapeSettings: params.setLocalShapeSettings,
        setThemePresets,
        setActivePresetId,
        setSelectedPresetId,
        onThemePalettesChange: params.onThemePalettesChange,
        onVisualSettingsChange: params.onVisualSettingsChange,
        onTypographySettingsChange: params.onTypographySettingsChange,
        onShapeSettingsChange: params.onShapeSettingsChange,
      });
    } finally {
      setThemePresetApplying(false);
    }
  }, [params, selectedPresetId]);

  const handleDeleteSelectedPreset = useCallback(async () => {
    setThemePresetDeleting(true);
    try {
      await deleteSelectedThemePreset({
        selectedPresetId,
        deletePreset: params.deletePreset,
        sanitizeTypographySettings: params.sanitizeTypographySettings,
        sanitizeShapeSettings: params.sanitizeShapeSettings,
        setThemePresets,
        setActivePresetId,
        setSelectedPresetId,
        setLocalTypographySettings: params.setLocalTypographySettings,
        setLocalShapeSettings: params.setLocalShapeSettings,
        onTypographySettingsChange: params.onTypographySettingsChange,
        onShapeSettingsChange: params.onShapeSettingsChange,
      });
    } finally {
      setThemePresetDeleting(false);
    }
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
    themePresetSaving,
    themePresetApplying,
    themePresetDeleting,
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
