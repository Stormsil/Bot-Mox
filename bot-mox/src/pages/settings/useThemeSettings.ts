import { useCallback, useEffect, useMemo, useState } from 'react';
import { message } from 'antd';
import {
  applyThemePreset,
  deleteThemePreset,
  saveThemePreset,
  updateThemeSettings,
  type ThemePreset,
  type ThemeSettings,
} from '../../services/themeService';
import {
  createDefaultThemePalettes,
  normalizeHexColor,
  type ThemeColorVariable,
  type ThemeMode,
  type ThemePalettes,
} from '../../theme/themePalette';

const DEFAULT_THEME_PALETTES = createDefaultThemePalettes();

interface EyeDropperOpenResult {
  sRGBHex: string;
}

interface EyeDropperApi {
  open: () => Promise<EyeDropperOpenResult>;
}

interface WindowWithEyeDropper extends Window {
  EyeDropper?: new () => EyeDropperApi;
}

interface UseThemeSettingsArgs {
  themePalettes?: ThemePalettes;
  onThemePalettesChange?: (palettes: ThemePalettes) => void;
}

interface UseThemeSettingsResult {
  themeSaving: boolean;
  themePresetSaving: boolean;
  themePresetApplying: boolean;
  themePresetDeleting: boolean;
  isThemeDrawerOpen: boolean;
  setIsThemeDrawerOpen: (open: boolean) => void;
  editingThemeMode: ThemeMode;
  setEditingThemeMode: (mode: ThemeMode) => void;
  themePresets: ThemePreset[];
  selectedPresetId?: string;
  setSelectedPresetId: (id?: string) => void;
  activePresetId?: string;
  newThemePresetName: string;
  setNewThemePresetName: (name: string) => void;
  localThemePalettes: ThemePalettes;
  themeInputValues: ThemePalettes;
  themePresetOptions: Array<{ label: string; value: string }>;
  applyThemeSettings: (settings: ThemeSettings) => void;
  updateThemeColor: (
    mode: ThemeMode,
    cssVar: ThemeColorVariable,
    rawColor: string,
    options?: { syncApp?: boolean }
  ) => void;
  handleThemeInputChange: (mode: ThemeMode, cssVar: ThemeColorVariable, value: string) => void;
  commitThemeInput: (mode: ThemeMode, cssVar: ThemeColorVariable) => void;
  handlePickColorFromScreen: (mode: ThemeMode, cssVar: ThemeColorVariable) => Promise<void>;
  handleResetCurrentPalette: () => void;
  handleSaveThemeColors: () => Promise<void>;
  handleSaveCurrentAsPreset: () => Promise<void>;
  handleApplySelectedPreset: () => Promise<void>;
  handleDeleteSelectedPreset: () => Promise<void>;
}

const cloneThemePalettes = (palettes: ThemePalettes): ThemePalettes => ({
  light: { ...palettes.light },
  dark: { ...palettes.dark },
});

const mapThemePresetsToList = (presets: Record<string, ThemePreset>): ThemePreset[] =>
  Object.values(presets).sort((a, b) => b.updated_at - a.updated_at);

export function useThemeSettings({
  themePalettes,
  onThemePalettesChange,
}: UseThemeSettingsArgs): UseThemeSettingsResult {
  const [themeSaving, setThemeSaving] = useState(false);
  const [themePresetSaving, setThemePresetSaving] = useState(false);
  const [themePresetApplying, setThemePresetApplying] = useState(false);
  const [themePresetDeleting, setThemePresetDeleting] = useState(false);
  const [isThemeDrawerOpen, setIsThemeDrawerOpen] = useState(false);
  const [editingThemeMode, setEditingThemeMode] = useState<ThemeMode>('light');
  const [themePresets, setThemePresets] = useState<ThemePreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string | undefined>();
  const [activePresetId, setActivePresetId] = useState<string | undefined>();
  const [newThemePresetName, setNewThemePresetName] = useState('');
  const [localThemePalettes, setLocalThemePalettes] = useState<ThemePalettes>(() =>
    cloneThemePalettes(themePalettes ?? DEFAULT_THEME_PALETTES)
  );
  const [themeInputValues, setThemeInputValues] = useState<ThemePalettes>(() =>
    cloneThemePalettes(themePalettes ?? DEFAULT_THEME_PALETTES)
  );

  useEffect(() => {
    if (!themePalettes) return;
    const cloned = cloneThemePalettes(themePalettes);
    setLocalThemePalettes(cloned);
    setThemeInputValues(cloned);
  }, [themePalettes]);

  const applyThemeSettings = useCallback((settings: ThemeSettings) => {
    const nextPalettes = cloneThemePalettes(settings.palettes);
    const presets = mapThemePresetsToList(settings.presets);
    setLocalThemePalettes(nextPalettes);
    setThemeInputValues(nextPalettes);
    setThemePresets(presets);
    setActivePresetId(settings.active_preset_id);
    setSelectedPresetId(settings.active_preset_id ?? presets[0]?.id);
    onThemePalettesChange?.(settings.palettes);
  }, [onThemePalettesChange]);

  const updateThemeColor = useCallback((
    mode: ThemeMode,
    cssVar: ThemeColorVariable,
    rawColor: string,
    options?: { syncApp?: boolean }
  ) => {
    const normalized = normalizeHexColor(rawColor, DEFAULT_THEME_PALETTES[mode][cssVar]);
    const shouldSyncApp = options?.syncApp ?? true;

    setLocalThemePalettes((current) => {
      const next: ThemePalettes = {
        ...current,
        [mode]: {
          ...current[mode],
          [cssVar]: normalized,
        },
      };
      if (shouldSyncApp) {
        onThemePalettesChange?.(next);
      }
      return next;
    });

    setThemeInputValues((current) => ({
      ...current,
      [mode]: {
        ...current[mode],
        [cssVar]: normalized,
      },
    }));
  }, [onThemePalettesChange]);

  const handleThemeInputChange = useCallback((
    mode: ThemeMode,
    cssVar: ThemeColorVariable,
    value: string
  ) => {
    setThemeInputValues((current) => ({
      ...current,
      [mode]: {
        ...current[mode],
        [cssVar]: value,
      },
    }));
  }, []);

  const commitThemeInput = useCallback((mode: ThemeMode, cssVar: ThemeColorVariable) => {
    updateThemeColor(mode, cssVar, themeInputValues[mode][cssVar]);
  }, [themeInputValues, updateThemeColor]);

  const handlePickColorFromScreen = useCallback(async (
    mode: ThemeMode,
    cssVar: ThemeColorVariable
  ) => {
    const eyedropperWindow = window as WindowWithEyeDropper;
    if (!eyedropperWindow.EyeDropper) {
      message.warning('Eyedropper API is not supported in this browser');
      return;
    }

    try {
      const eyeDropper = new eyedropperWindow.EyeDropper();
      const result = await eyeDropper.open();
      updateThemeColor(mode, cssVar, result.sRGBHex);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      console.error('Eyedropper failed:', error);
      message.error('Failed to pick color from screen');
    }
  }, [updateThemeColor]);

  const handleResetCurrentPalette = useCallback(() => {
    const resetPalette = { ...DEFAULT_THEME_PALETTES[editingThemeMode] };

    setLocalThemePalettes((current) => {
      const next: ThemePalettes = {
        ...current,
        [editingThemeMode]: resetPalette,
      };
      onThemePalettesChange?.(next);
      return next;
    });

    setThemeInputValues((current) => ({
      ...current,
      [editingThemeMode]: { ...resetPalette },
    }));
  }, [editingThemeMode, onThemePalettesChange]);

  const handleSaveThemeColors = useCallback(async () => {
    setThemeSaving(true);
    try {
      await updateThemeSettings(localThemePalettes, undefined, activePresetId, {
        syncActivePreset: true,
      });
      message.success('Theme colors saved');
    } catch (error) {
      console.error('Error saving theme colors:', error);
      message.error('Failed to save theme colors');
    } finally {
      setThemeSaving(false);
    }
  }, [activePresetId, localThemePalettes]);

  const handleSaveCurrentAsPreset = useCallback(async () => {
    const presetName = newThemePresetName.trim();
    if (!presetName) {
      message.warning('Enter theme name first');
      return;
    }

    setThemePresetSaving(true);
    try {
      const preset = await saveThemePreset(presetName, localThemePalettes);
      setThemePresets((current) =>
        mapThemePresetsToList({
          ...Object.fromEntries(current.map((item) => [item.id, item])),
          [preset.id]: preset,
        })
      );
      setSelectedPresetId(preset.id);
      setActivePresetId(preset.id);
      setNewThemePresetName('');
      message.success(`Theme "${preset.name}" saved`);
    } catch (error) {
      console.error('Error saving theme preset:', error);
      message.error('Failed to save theme preset');
    } finally {
      setThemePresetSaving(false);
    }
  }, [localThemePalettes, newThemePresetName]);

  const handleApplySelectedPreset = useCallback(async () => {
    if (!selectedPresetId) {
      message.warning('Select saved theme first');
      return;
    }

    setThemePresetApplying(true);
    try {
      const nextSettings = await applyThemePreset(selectedPresetId);
      const nextPalettes = cloneThemePalettes(nextSettings.palettes);
      setLocalThemePalettes(nextPalettes);
      setThemeInputValues(nextPalettes);
      setThemePresets(mapThemePresetsToList(nextSettings.presets));
      setActivePresetId(nextSettings.active_preset_id);
      setSelectedPresetId(nextSettings.active_preset_id ?? selectedPresetId);
      onThemePalettesChange?.(nextSettings.palettes);
      message.success('Theme applied');
    } catch (error) {
      console.error('Error applying theme preset:', error);
      message.error('Failed to apply theme');
    } finally {
      setThemePresetApplying(false);
    }
  }, [onThemePalettesChange, selectedPresetId]);

  const handleDeleteSelectedPreset = useCallback(async () => {
    if (!selectedPresetId) {
      return;
    }

    setThemePresetDeleting(true);
    try {
      const nextSettings = await deleteThemePreset(selectedPresetId);
      const nextPresets = mapThemePresetsToList(nextSettings.presets);
      setThemePresets(nextPresets);
      setActivePresetId(nextSettings.active_preset_id);
      setSelectedPresetId(nextSettings.active_preset_id ?? nextPresets[0]?.id);
      message.success('Theme preset deleted');
    } catch (error) {
      console.error('Error deleting theme preset:', error);
      message.error('Failed to delete theme preset');
    } finally {
      setThemePresetDeleting(false);
    }
  }, [selectedPresetId]);

  const themePresetOptions = useMemo(() => {
    return themePresets.map((preset) => ({
      label: preset.id === activePresetId ? `${preset.name} (active)` : preset.name,
      value: preset.id,
    }));
  }, [activePresetId, themePresets]);

  return {
    themeSaving,
    themePresetSaving,
    themePresetApplying,
    themePresetDeleting,
    isThemeDrawerOpen,
    setIsThemeDrawerOpen,
    editingThemeMode,
    setEditingThemeMode,
    themePresets,
    selectedPresetId,
    setSelectedPresetId,
    activePresetId,
    newThemePresetName,
    setNewThemePresetName,
    localThemePalettes,
    themeInputValues,
    themePresetOptions,
    applyThemeSettings,
    updateThemeColor,
    handleThemeInputChange,
    commitThemeInput,
    handlePickColorFromScreen,
    handleResetCurrentPalette,
    handleSaveThemeColors,
    handleSaveCurrentAsPreset,
    handleApplySelectedPreset,
    handleDeleteSelectedPreset,
  };
}
