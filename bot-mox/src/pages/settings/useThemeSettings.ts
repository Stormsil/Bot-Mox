import { useCallback, useEffect, useMemo, useState } from 'react';
import { message } from 'antd';
import {
  applyThemePreset,
  deleteThemePreset,
  saveThemePreset,
  updateThemeSettings,
  updateThemeVisualSettings,
  type ThemePreset,
  type ThemeSettings,
} from '../../services/themeService';
import {
  deleteThemeAsset,
  listThemeAssets,
  uploadThemeAsset,
  type ThemeBackgroundAsset,
} from '../../services/themeAssetsService';
import {
  createDefaultThemePalettes,
  normalizeHexColor,
  sanitizeThemeShapeSettings,
  sanitizeThemeTypographySettings,
  sanitizeThemeVisualSettings,
  type ThemeColorVariable,
  type ThemeMode,
  type ThemePalettes,
  type ThemeShapeSettings,
  type ThemeTypographySettings,
  type ThemeVisualSettings,
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
  visualSettings?: ThemeVisualSettings;
  onVisualSettingsChange?: (visual: ThemeVisualSettings) => void;
  typographySettings?: ThemeTypographySettings;
  onTypographySettingsChange?: (typography: ThemeTypographySettings) => void;
  shapeSettings?: ThemeShapeSettings;
  onShapeSettingsChange?: (shape: ThemeShapeSettings) => void;
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
  localVisualSettings: ThemeVisualSettings;
  localTypographySettings: ThemeTypographySettings;
  localShapeSettings: ThemeShapeSettings;
  themeAssets: ThemeBackgroundAsset[];
  themeAssetsLoading: boolean;
  themeAssetUploading: boolean;
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
  handleSaveVisualSettings: () => Promise<void>;
  handleVisualSettingsChange: (patch: Partial<ThemeVisualSettings>) => void;
  handleTypographySettingsChange: (patch: Partial<ThemeTypographySettings>) => void;
  handleShapeSettingsChange: (patch: Partial<ThemeShapeSettings>) => void;
  handleRefreshThemeAssets: () => Promise<void>;
  handleUploadThemeAsset: (file: File) => Promise<void>;
  handleSelectThemeBackground: (assetId?: string) => void;
  handleDeleteThemeAsset: (assetId: string) => Promise<void>;
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
  visualSettings,
  onVisualSettingsChange,
  typographySettings,
  onTypographySettingsChange,
  shapeSettings,
  onShapeSettingsChange,
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
  const [themeAssetsLoading, setThemeAssetsLoading] = useState(false);
  const [themeAssetUploading, setThemeAssetUploading] = useState(false);
  const [themeAssets, setThemeAssets] = useState<ThemeBackgroundAsset[]>([]);
  const [localThemePalettes, setLocalThemePalettes] = useState<ThemePalettes>(() =>
    cloneThemePalettes(themePalettes ?? DEFAULT_THEME_PALETTES)
  );
  const [themeInputValues, setThemeInputValues] = useState<ThemePalettes>(() =>
    cloneThemePalettes(themePalettes ?? DEFAULT_THEME_PALETTES)
  );
  const [localVisualSettings, setLocalVisualSettings] = useState<ThemeVisualSettings>(() =>
    sanitizeThemeVisualSettings(visualSettings)
  );
  const [localTypographySettings, setLocalTypographySettings] = useState<ThemeTypographySettings>(() =>
    sanitizeThemeTypographySettings(typographySettings)
  );
  const [localShapeSettings, setLocalShapeSettings] = useState<ThemeShapeSettings>(() =>
    sanitizeThemeShapeSettings(shapeSettings)
  );

  useEffect(() => {
    if (!themePalettes) return;
    const cloned = cloneThemePalettes(themePalettes);
    setLocalThemePalettes(cloned);
    setThemeInputValues(cloned);
  }, [themePalettes]);

  useEffect(() => {
    setLocalVisualSettings(sanitizeThemeVisualSettings(visualSettings));
  }, [visualSettings]);

  useEffect(() => {
    setLocalTypographySettings(sanitizeThemeTypographySettings(typographySettings));
  }, [typographySettings]);

  useEffect(() => {
    setLocalShapeSettings(sanitizeThemeShapeSettings(shapeSettings));
  }, [shapeSettings]);

  const handleRefreshThemeAssets = useCallback(async () => {
    setThemeAssetsLoading(true);
    try {
      const data = await listThemeAssets();
      setThemeAssets(data.items.filter((item) => item.status === 'ready' || item.status === 'pending'));
    } catch (error) {
      console.error('Error loading theme assets:', error);
      message.error('Failed to load background images');
    } finally {
      setThemeAssetsLoading(false);
    }
  }, []);

  useEffect(() => {
    void handleRefreshThemeAssets();
  }, [handleRefreshThemeAssets]);

  const applyThemeSettings = useCallback((settings: ThemeSettings) => {
    const nextPalettes = cloneThemePalettes(settings.palettes);
    const presets = mapThemePresetsToList(settings.presets);
    const nextVisual = sanitizeThemeVisualSettings(settings.visual);
    const nextTypography = sanitizeThemeTypographySettings(settings.typography);
    const nextShape = sanitizeThemeShapeSettings(settings.shape);
    setLocalThemePalettes(nextPalettes);
    setThemeInputValues(nextPalettes);
    setThemePresets(presets);
    setActivePresetId(settings.active_preset_id);
    setSelectedPresetId(settings.active_preset_id ?? presets[0]?.id);
    setLocalVisualSettings(nextVisual);
    setLocalTypographySettings(nextTypography);
    setLocalShapeSettings(nextShape);
    onThemePalettesChange?.(settings.palettes);
    onVisualSettingsChange?.(nextVisual);
    onTypographySettingsChange?.(nextTypography);
    onShapeSettingsChange?.(nextShape);
  }, [onShapeSettingsChange, onThemePalettesChange, onTypographySettingsChange, onVisualSettingsChange]);

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
      }, localVisualSettings, localTypographySettings, localShapeSettings);
      message.success('Theme colors saved');
    } catch (error) {
      console.error('Error saving theme colors:', error);
      message.error('Failed to save theme colors');
    } finally {
      setThemeSaving(false);
    }
  }, [activePresetId, localShapeSettings, localThemePalettes, localTypographySettings, localVisualSettings]);

  const handleVisualSettingsChange = useCallback((patch: Partial<ThemeVisualSettings>) => {
    setLocalVisualSettings((current) => {
      const next = sanitizeThemeVisualSettings({ ...current, ...patch });
      onVisualSettingsChange?.(next);
      return next;
    });
  }, [onVisualSettingsChange]);

  const handleTypographySettingsChange = useCallback((patch: Partial<ThemeTypographySettings>) => {
    setLocalTypographySettings((current) => {
      const next = sanitizeThemeTypographySettings({ ...current, ...patch });
      onTypographySettingsChange?.(next);
      return next;
    });
  }, [onTypographySettingsChange]);

  const handleShapeSettingsChange = useCallback((patch: Partial<ThemeShapeSettings>) => {
    setLocalShapeSettings((current) => {
      const next = sanitizeThemeShapeSettings({ ...current, ...patch });
      onShapeSettingsChange?.(next);
      return next;
    });
  }, [onShapeSettingsChange]);

  const handleSaveVisualSettings = useCallback(async () => {
    setThemeSaving(true);
    try {
      await updateThemeVisualSettings(localVisualSettings);
      message.success('Visual theme settings saved');
    } catch (error) {
      console.error('Error saving visual theme settings:', error);
      message.error('Failed to save visual theme settings');
    } finally {
      setThemeSaving(false);
    }
  }, [localVisualSettings]);

  const handleUploadThemeAsset = useCallback(async (file: File) => {
    setThemeAssetUploading(true);
    try {
      const uploaded = await uploadThemeAsset(file);
      setThemeAssets((current) => [uploaded, ...current.filter((item) => item.id !== uploaded.id)]);
      setLocalVisualSettings((current) => {
        const next = sanitizeThemeVisualSettings({
          ...current,
          enabled: true,
          mode: 'image',
          backgroundAssetId: uploaded.id,
          backgroundImageUrl: uploaded.image_url || undefined,
        });
        onVisualSettingsChange?.(next);
        return next;
      });
      message.success('Background image uploaded');
    } catch (error) {
      console.error('Error uploading theme asset:', error);
      message.error(error instanceof Error ? error.message : 'Failed to upload background image');
    } finally {
      setThemeAssetUploading(false);
    }
  }, [onVisualSettingsChange]);

  const handleSelectThemeBackground = useCallback((assetId?: string) => {
    const selectedAsset = themeAssets.find((item) => item.id === assetId);

    setLocalVisualSettings((current) => {
      const next = sanitizeThemeVisualSettings({
        ...current,
        enabled: Boolean(assetId),
        mode: assetId ? 'image' : 'none',
        backgroundAssetId: assetId,
        backgroundImageUrl: selectedAsset?.image_url || undefined,
      });
      onVisualSettingsChange?.(next);
      return next;
    });
  }, [onVisualSettingsChange, themeAssets]);

  const handleDeleteThemeAsset = useCallback(async (assetId: string) => {
    try {
      await deleteThemeAsset(assetId);
      setThemeAssets((current) => current.filter((item) => item.id !== assetId));
      setLocalVisualSettings((current) => {
        if (current.backgroundAssetId !== assetId) {
          return current;
        }
        const next = sanitizeThemeVisualSettings({
          ...current,
          enabled: false,
          mode: 'none',
          backgroundAssetId: undefined,
          backgroundImageUrl: undefined,
        });
        onVisualSettingsChange?.(next);
        return next;
      });
      message.success('Background image deleted');
    } catch (error) {
      console.error('Error deleting theme asset:', error);
      message.error('Failed to delete background image');
    }
  }, [onVisualSettingsChange]);

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
      const nextVisual = sanitizeThemeVisualSettings(nextSettings.visual);
      const nextTypography = sanitizeThemeTypographySettings(nextSettings.typography);
      const nextShape = sanitizeThemeShapeSettings(nextSettings.shape);
      setLocalThemePalettes(nextPalettes);
      setThemeInputValues(nextPalettes);
      setLocalVisualSettings(nextVisual);
      setLocalTypographySettings(nextTypography);
      setLocalShapeSettings(nextShape);
      setThemePresets(mapThemePresetsToList(nextSettings.presets));
      setActivePresetId(nextSettings.active_preset_id);
      setSelectedPresetId(nextSettings.active_preset_id ?? selectedPresetId);
      onThemePalettesChange?.(nextSettings.palettes);
      onVisualSettingsChange?.(nextVisual);
      onTypographySettingsChange?.(nextTypography);
      onShapeSettingsChange?.(nextShape);
      message.success('Theme applied');
    } catch (error) {
      console.error('Error applying theme preset:', error);
      message.error('Failed to apply theme');
    } finally {
      setThemePresetApplying(false);
    }
  }, [onShapeSettingsChange, onThemePalettesChange, onTypographySettingsChange, onVisualSettingsChange, selectedPresetId]);

  const handleDeleteSelectedPreset = useCallback(async () => {
    if (!selectedPresetId) {
      return;
    }

    setThemePresetDeleting(true);
    try {
      const nextSettings = await deleteThemePreset(selectedPresetId);
      const nextPresets = mapThemePresetsToList(nextSettings.presets);
      const nextTypography = sanitizeThemeTypographySettings(nextSettings.typography);
      const nextShape = sanitizeThemeShapeSettings(nextSettings.shape);
      setThemePresets(nextPresets);
      setActivePresetId(nextSettings.active_preset_id);
      setSelectedPresetId(nextSettings.active_preset_id ?? nextPresets[0]?.id);
      setLocalTypographySettings(nextTypography);
      setLocalShapeSettings(nextShape);
      onTypographySettingsChange?.(nextTypography);
      onShapeSettingsChange?.(nextShape);
      message.success('Theme preset deleted');
    } catch (error) {
      console.error('Error deleting theme preset:', error);
      message.error('Failed to delete theme preset');
    } finally {
      setThemePresetDeleting(false);
    }
  }, [onShapeSettingsChange, onTypographySettingsChange, selectedPresetId]);

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
    localVisualSettings,
    localTypographySettings,
    localShapeSettings,
    themeAssets,
    themeAssetsLoading,
    themeAssetUploading,
    themePresetOptions,
    applyThemeSettings,
    updateThemeColor,
    handleThemeInputChange,
    commitThemeInput,
    handlePickColorFromScreen,
    handleResetCurrentPalette,
    handleSaveThemeColors,
    handleSaveVisualSettings,
    handleVisualSettingsChange,
    handleTypographySettingsChange,
    handleShapeSettingsChange,
    handleRefreshThemeAssets,
    handleUploadThemeAsset,
    handleSelectThemeBackground,
    handleDeleteThemeAsset,
    handleSaveCurrentAsPreset,
    handleApplySelectedPreset,
    handleDeleteSelectedPreset,
  };
}
