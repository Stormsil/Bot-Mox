import { message } from 'antd';
import { useCallback, useMemo, useState } from 'react';
import { useThemeAssetsQuery } from '../../entities/settings/api/useThemeAssetsQuery';
import {
  useApplyThemePresetMutation,
  useDeleteThemeAssetMutation,
  useDeleteThemePresetMutation,
  useSaveThemePresetMutation,
  useUpdateThemeSettingsMutation,
  useUpdateThemeVisualSettingsMutation,
  useUploadThemeAssetMutation,
} from '../../entities/settings/api/useThemeMutations';
import { uiLogger } from '../../observability/uiLogger';
import {
  createDefaultThemePalettes,
  normalizeHexColor,
  sanitizeThemeShapeSettings,
  sanitizeThemeTypographySettings,
  sanitizeThemeVisualSettings,
} from '../../theme/themePalette';
import {
  applySelectedThemePreset,
  deleteSelectedThemePreset,
  saveCurrentThemePreset,
} from './themePresetActions';
import {
  cloneThemePalettes,
  mapThemePresetsToList,
  type WindowWithEyeDropper,
} from './themeSettings.helpers';
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
  UseThemeSettingsArgs,
  UseThemeSettingsResult,
} from './themeSettings.types';
import { useThemeSettingsSync } from './useThemeSettingsSync';

const DEFAULT_THEME_PALETTES = createDefaultThemePalettes();

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
  const themeAssetsQuery = useThemeAssetsQuery();
  const updateThemeSettingsMutation = useUpdateThemeSettingsMutation();
  const updateThemeVisualSettingsMutation = useUpdateThemeVisualSettingsMutation();
  const saveThemePresetMutation = useSaveThemePresetMutation();
  const applyThemePresetMutation = useApplyThemePresetMutation();
  const deleteThemePresetMutation = useDeleteThemePresetMutation();
  const uploadThemeAssetMutation = useUploadThemeAssetMutation();
  const deleteThemeAssetMutation = useDeleteThemeAssetMutation();
  const [localThemePalettes, setLocalThemePalettes] = useState<ThemePalettes>(() =>
    cloneThemePalettes(themePalettes ?? DEFAULT_THEME_PALETTES),
  );
  const [themeInputValues, setThemeInputValues] = useState<ThemePalettes>(() =>
    cloneThemePalettes(themePalettes ?? DEFAULT_THEME_PALETTES),
  );
  const [localVisualSettings, setLocalVisualSettings] = useState<ThemeVisualSettings>(() =>
    sanitizeThemeVisualSettings(visualSettings),
  );
  const [localTypographySettings, setLocalTypographySettings] = useState<ThemeTypographySettings>(
    () => sanitizeThemeTypographySettings(typographySettings),
  );
  const [localShapeSettings, setLocalShapeSettings] = useState<ThemeShapeSettings>(() =>
    sanitizeThemeShapeSettings(shapeSettings),
  );

  useThemeSettingsSync({
    themePalettes,
    visualSettings,
    typographySettings,
    shapeSettings,
    setLocalThemePalettes,
    setThemeInputValues,
    setLocalVisualSettings,
    setLocalTypographySettings,
    setLocalShapeSettings,
  });

  const themeAssets = useMemo<ThemeBackgroundAsset[]>(
    () => themeAssetsQuery.data || [],
    [themeAssetsQuery.data],
  );
  const themeAssetsLoading = themeAssetsQuery.isLoading || themeAssetsQuery.isFetching;
  const themeAssetUploading = uploadThemeAssetMutation.isPending;

  const handleRefreshThemeAssets = useCallback(async () => {
    try {
      await themeAssetsQuery.refetch();
    } catch (error) {
      uiLogger.error('Error loading theme assets:', error);
      message.error('Failed to load background images');
    }
  }, [themeAssetsQuery]);

  const applyThemeSettings = useCallback(
    (settings: ThemeSettings) => {
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
    },
    [
      onShapeSettingsChange,
      onThemePalettesChange,
      onTypographySettingsChange,
      onVisualSettingsChange,
    ],
  );

  const updateThemeColor = useCallback(
    (
      mode: ThemeMode,
      cssVar: ThemeColorVariable,
      rawColor: string,
      options?: { syncApp?: boolean },
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
    },
    [onThemePalettesChange],
  );

  const handleThemeInputChange = useCallback(
    (mode: ThemeMode, cssVar: ThemeColorVariable, value: string) => {
      setThemeInputValues((current) => ({
        ...current,
        [mode]: {
          ...current[mode],
          [cssVar]: value,
        },
      }));
    },
    [],
  );

  const commitThemeInput = useCallback(
    (mode: ThemeMode, cssVar: ThemeColorVariable) => {
      updateThemeColor(mode, cssVar, themeInputValues[mode][cssVar]);
    },
    [themeInputValues, updateThemeColor],
  );

  const handlePickColorFromScreen = useCallback(
    async (mode: ThemeMode, cssVar: ThemeColorVariable) => {
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
        uiLogger.error('Eyedropper failed:', error);
        message.error('Failed to pick color from screen');
      }
    },
    [updateThemeColor],
  );

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
      await updateThemeSettingsMutation.mutateAsync({
        palettes: localThemePalettes,
        activePresetId,
        options: { syncActivePreset: true },
        visualSettings: localVisualSettings,
        typographySettings: localTypographySettings,
        shapeSettings: localShapeSettings,
      });
      message.success('Theme colors saved');
    } catch (error) {
      uiLogger.error('Error saving theme colors:', error);
      message.error('Failed to save theme colors');
    } finally {
      setThemeSaving(false);
    }
  }, [
    activePresetId,
    localShapeSettings,
    localThemePalettes,
    localTypographySettings,
    localVisualSettings,
    updateThemeSettingsMutation,
  ]);

  const handleVisualSettingsChange = useCallback(
    (patch: Partial<ThemeVisualSettings>) => {
      setLocalVisualSettings((current) => {
        const next = sanitizeThemeVisualSettings({ ...current, ...patch });
        onVisualSettingsChange?.(next);
        return next;
      });
    },
    [onVisualSettingsChange],
  );

  const handleTypographySettingsChange = useCallback(
    (patch: Partial<ThemeTypographySettings>) => {
      setLocalTypographySettings((current) => {
        const next = sanitizeThemeTypographySettings({ ...current, ...patch });
        onTypographySettingsChange?.(next);
        return next;
      });
    },
    [onTypographySettingsChange],
  );

  const handleShapeSettingsChange = useCallback(
    (patch: Partial<ThemeShapeSettings>) => {
      setLocalShapeSettings((current) => {
        const next = sanitizeThemeShapeSettings({ ...current, ...patch });
        onShapeSettingsChange?.(next);
        return next;
      });
    },
    [onShapeSettingsChange],
  );

  const handleSaveVisualSettings = useCallback(async () => {
    setThemeSaving(true);
    try {
      await updateThemeVisualSettingsMutation.mutateAsync({ visual: localVisualSettings });
      message.success('Visual theme settings saved');
    } catch (error) {
      uiLogger.error('Error saving visual theme settings:', error);
      message.error('Failed to save visual theme settings');
    } finally {
      setThemeSaving(false);
    }
  }, [localVisualSettings, updateThemeVisualSettingsMutation]);

  const handleUploadThemeAsset = useCallback(
    async (file: File) => {
      try {
        const uploaded = await uploadThemeAssetMutation.mutateAsync(file);
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
        uiLogger.error('Error uploading theme asset:', error);
        message.error(error instanceof Error ? error.message : 'Failed to upload background image');
      }
    },
    [onVisualSettingsChange, uploadThemeAssetMutation],
  );

  const handleSelectThemeBackground = useCallback(
    (assetId?: string) => {
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
    },
    [onVisualSettingsChange, themeAssets],
  );

  const handleDeleteThemeAsset = useCallback(
    async (assetId: string) => {
      try {
        await deleteThemeAssetMutation.mutateAsync(assetId);
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
        uiLogger.error('Error deleting theme asset:', error);
        message.error('Failed to delete background image');
      }
    },
    [deleteThemeAssetMutation, onVisualSettingsChange],
  );

  const handleSaveCurrentAsPreset = useCallback(async () => {
    setThemePresetSaving(true);
    try {
      await saveCurrentThemePreset({
        newThemePresetName,
        localThemePalettes,
        savePreset: (payload) => saveThemePresetMutation.mutateAsync(payload),
        setThemePresets,
        setSelectedPresetId,
        setActivePresetId,
        setNewThemePresetName,
      });
    } finally {
      setThemePresetSaving(false);
    }
  }, [localThemePalettes, newThemePresetName, saveThemePresetMutation]);

  const handleApplySelectedPreset = useCallback(async () => {
    setThemePresetApplying(true);
    try {
      await applySelectedThemePreset({
        selectedPresetId,
        applyPreset: ({ presetId }) => applyThemePresetMutation.mutateAsync({ presetId }),
        sanitizeVisualSettings: sanitizeThemeVisualSettings,
        sanitizeTypographySettings: sanitizeThemeTypographySettings,
        sanitizeShapeSettings: sanitizeThemeShapeSettings,
        setLocalThemePalettes,
        setThemeInputValues,
        setLocalVisualSettings,
        setLocalTypographySettings,
        setLocalShapeSettings,
        setThemePresets,
        setActivePresetId,
        setSelectedPresetId,
        onThemePalettesChange,
        onVisualSettingsChange,
        onTypographySettingsChange,
        onShapeSettingsChange,
      });
    } finally {
      setThemePresetApplying(false);
    }
  }, [
    applyThemePresetMutation,
    onShapeSettingsChange,
    onThemePalettesChange,
    onTypographySettingsChange,
    onVisualSettingsChange,
    selectedPresetId,
  ]);

  const handleDeleteSelectedPreset = useCallback(async () => {
    setThemePresetDeleting(true);
    try {
      await deleteSelectedThemePreset({
        selectedPresetId,
        deletePreset: ({ presetId }) => deleteThemePresetMutation.mutateAsync({ presetId }),
        sanitizeTypographySettings: sanitizeThemeTypographySettings,
        sanitizeShapeSettings: sanitizeThemeShapeSettings,
        setThemePresets,
        setActivePresetId,
        setSelectedPresetId,
        setLocalTypographySettings,
        setLocalShapeSettings,
        onTypographySettingsChange,
        onShapeSettingsChange,
      });
    } finally {
      setThemePresetDeleting(false);
    }
  }, [
    deleteThemePresetMutation,
    onShapeSettingsChange,
    onTypographySettingsChange,
    selectedPresetId,
  ]);

  const themePresetOptions = useMemo(
    () =>
      themePresets.map((preset) => ({
        label: preset.id === activePresetId ? `${preset.name} (active)` : preset.name,
        value: preset.id,
      })),
    [activePresetId, themePresets],
  );

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
