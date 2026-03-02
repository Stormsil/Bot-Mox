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
import {
  createDefaultThemePalettes,
  sanitizeThemeShapeSettings,
  sanitizeThemeTypographySettings,
  sanitizeThemeVisualSettings,
} from '../../theme/themePalette';
import { cloneThemePalettes } from './themeSettings.helpers';
import type {
  ThemeBackgroundAsset,
  ThemeMode,
  ThemePalettes,
  ThemeSettings,
  ThemeShapeSettings,
  ThemeTypographySettings,
  ThemeVisualSettings,
  UseThemeSettingsArgs,
  UseThemeSettingsResult,
} from './themeSettings.types';
import {
  applyThemeSettingsState,
  refreshThemeAssetsAction,
  selectThemeBackgroundState,
} from './themeSettingsStateActions';
import { useThemeColorControls } from './useThemeColorControls';
import { useThemePresetControls } from './useThemePresetControls';
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
  const [isThemeDrawerOpen, setIsThemeDrawerOpen] = useState(false);
  const [editingThemeMode, setEditingThemeMode] = useState<ThemeMode>('light');
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

  const {
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
  } = useThemePresetControls({
    savePreset: (payload, options) => saveThemePresetMutation.mutate(payload, options),
    applyPreset: ({ presetId }, options) => applyThemePresetMutation.mutate({ presetId }, options),
    deletePreset: ({ presetId }, options) =>
      deleteThemePresetMutation.mutate({ presetId }, options),
    themePresetSaving: saveThemePresetMutation.isPending,
    themePresetApplying: applyThemePresetMutation.isPending,
    themePresetDeleting: deleteThemePresetMutation.isPending,
    localThemePalettes,
    sanitizeVisualSettings: sanitizeThemeVisualSettings,
    sanitizeTypographySettings: sanitizeThemeTypographySettings,
    sanitizeShapeSettings: sanitizeThemeShapeSettings,
    setLocalThemePalettes,
    setThemeInputValues,
    setLocalVisualSettings,
    setLocalTypographySettings,
    setLocalShapeSettings,
    onThemePalettesChange,
    onVisualSettingsChange,
    onTypographySettingsChange,
    onShapeSettingsChange,
  });

  const handleRefreshThemeAssets = useCallback(async () => {
    await refreshThemeAssetsAction(themeAssetsQuery.refetch);
  }, [themeAssetsQuery]);

  const applyThemeSettings = useCallback(
    (settings: ThemeSettings) => {
      applyThemeSettingsState({
        settings,
        setLocalThemePalettes,
        setThemeInputValues,
        setThemePresets,
        setActivePresetId,
        setSelectedPresetId,
        setLocalVisualSettings,
        setLocalTypographySettings,
        setLocalShapeSettings,
        onThemePalettesChange,
        onVisualSettingsChange,
        onTypographySettingsChange,
        onShapeSettingsChange,
      });
    },
    [
      onShapeSettingsChange,
      onThemePalettesChange,
      onTypographySettingsChange,
      onVisualSettingsChange,
      setThemePresets,
      setActivePresetId,
      setSelectedPresetId,
    ],
  );

  const {
    updateThemeColor,
    handleThemeInputChange,
    commitThemeInput,
    handlePickColorFromScreen,
    handleResetCurrentPalette,
  } = useThemeColorControls({
    editingThemeMode,
    defaultThemePalettes: DEFAULT_THEME_PALETTES,
    themeInputValues,
    onThemePalettesChange,
    setLocalThemePalettes,
    setThemeInputValues,
  });

  const themeSaving =
    updateThemeSettingsMutation.isPending || updateThemeVisualSettingsMutation.isPending;

  const handleSaveThemeColors = useCallback(async () => {
    await new Promise<void>((resolve) => {
      updateThemeSettingsMutation.mutate(
        {
          palettes: localThemePalettes,
          activePresetId,
          options: { syncActivePreset: true },
          visualSettings: localVisualSettings,
          typographySettings: localTypographySettings,
          shapeSettings: localShapeSettings,
        },
        {
          onSettled: () => resolve(),
        },
      );
    });
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
    await new Promise<void>((resolve) => {
      updateThemeVisualSettingsMutation.mutate(
        { visual: localVisualSettings },
        {
          onSettled: () => resolve(),
        },
      );
    });
  }, [localVisualSettings, updateThemeVisualSettingsMutation]);

  const handleUploadThemeAsset = useCallback(
    async (file: File) => {
      await new Promise<void>((resolve) => {
        uploadThemeAssetMutation.mutate(file, {
          onSuccess: (uploaded) => {
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
          },
          onSettled: () => resolve(),
        });
      });
    },
    [onVisualSettingsChange, uploadThemeAssetMutation],
  );

  const handleSelectThemeBackground = useCallback(
    (assetId?: string) => {
      selectThemeBackgroundState({
        assetId,
        themeAssets,
        setLocalVisualSettings,
        onVisualSettingsChange,
      });
    },
    [onVisualSettingsChange, themeAssets],
  );

  const handleDeleteThemeAsset = useCallback(
    async (assetId: string) => {
      await new Promise<void>((resolve) => {
        deleteThemeAssetMutation.mutate(assetId, {
          onSuccess: () => {
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
          },
          onSettled: () => resolve(),
        });
      });
    },
    [deleteThemeAssetMutation, onVisualSettingsChange],
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
