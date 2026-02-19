import { type UseMutationResult, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  ThemeMode,
  ThemePalettes,
  ThemeShapeSettings,
  ThemeTypographySettings,
  ThemeVisualSettings,
} from '../../../theme/themePalette';
import { settingsQueryKeys } from './settingsQueryKeys';
import {
  applyThemePreset,
  deleteThemeAsset,
  deleteThemePreset,
  saveThemePreset,
  type ThemeBackgroundAsset,
  type ThemePreset,
  type ThemeSettings,
  updateThemeSettings,
  updateThemeVisualSettings,
  uploadThemeAsset,
} from './themeFacade';

type UpdateThemeSettingsPayload = {
  palettes: ThemePalettes;
  userId?: string;
  activePresetId?: string;
  options?: { syncActivePreset?: boolean };
  visualSettings?: ThemeVisualSettings;
  typographySettings?: ThemeTypographySettings;
  shapeSettings?: ThemeShapeSettings;
};

type UpdateThemeVisualSettingsPayload = {
  visual: ThemeVisualSettings;
  userId?: string;
};

type SaveThemePresetPayload = {
  name: string;
  palettes: ThemePalettes;
  userId?: string;
};

type ApplyThemePresetPayload = {
  presetId: string;
  userId?: string;
};

type DeleteThemePresetPayload = {
  presetId: string;
  userId?: string;
};

export function useUpdateThemeSettingsMutation(): UseMutationResult<
  void,
  Error,
  UpdateThemeSettingsPayload
> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, UpdateThemeSettingsPayload>({
    mutationFn: async (payload) => {
      await updateThemeSettings(
        payload.palettes,
        payload.userId,
        payload.activePresetId,
        payload.options,
        payload.visualSettings,
        payload.typographySettings,
        payload.shapeSettings,
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: settingsQueryKeys.theme() });
    },
  });
}

export function useUpdateThemeVisualSettingsMutation(): UseMutationResult<
  void,
  Error,
  UpdateThemeVisualSettingsPayload
> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, UpdateThemeVisualSettingsPayload>({
    mutationFn: async ({ visual, userId }) => {
      await updateThemeVisualSettings(visual, userId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: settingsQueryKeys.theme() });
    },
  });
}

export function useSaveThemePresetMutation(): UseMutationResult<
  ThemePreset,
  Error,
  SaveThemePresetPayload
> {
  const queryClient = useQueryClient();

  return useMutation<ThemePreset, Error, SaveThemePresetPayload>({
    mutationFn: async ({ name, palettes, userId }) => saveThemePreset(name, palettes, userId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: settingsQueryKeys.theme() });
    },
  });
}

export function useApplyThemePresetMutation(): UseMutationResult<
  ThemeSettings,
  Error,
  ApplyThemePresetPayload
> {
  const queryClient = useQueryClient();

  return useMutation<ThemeSettings, Error, ApplyThemePresetPayload>({
    mutationFn: async ({ presetId, userId }) => applyThemePreset(presetId, userId),
    onSuccess: async (data) => {
      queryClient.setQueryData(settingsQueryKeys.theme(), data);
      await queryClient.invalidateQueries({ queryKey: settingsQueryKeys.theme() });
    },
  });
}

export function useDeleteThemePresetMutation(): UseMutationResult<
  ThemeSettings,
  Error,
  DeleteThemePresetPayload
> {
  const queryClient = useQueryClient();

  return useMutation<ThemeSettings, Error, DeleteThemePresetPayload>({
    mutationFn: async ({ presetId, userId }) => deleteThemePreset(presetId, userId),
    onSuccess: async (data) => {
      queryClient.setQueryData(settingsQueryKeys.theme(), data);
      await queryClient.invalidateQueries({ queryKey: settingsQueryKeys.theme() });
    },
  });
}

export function useUploadThemeAssetMutation(): UseMutationResult<
  ThemeBackgroundAsset,
  Error,
  File
> {
  const queryClient = useQueryClient();

  return useMutation<ThemeBackgroundAsset, Error, File>({
    mutationFn: async (file) => uploadThemeAsset(file),
    onSuccess: async (uploaded) => {
      queryClient.setQueryData<ThemeBackgroundAsset[]>(
        settingsQueryKeys.themeAssets(),
        (current) => {
          const next = current || [];
          return [uploaded, ...next.filter((item) => item.id !== uploaded.id)];
        },
      );
      await queryClient.invalidateQueries({ queryKey: settingsQueryKeys.themeAssets() });
    },
  });
}

export function useDeleteThemeAssetMutation(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (assetId) => {
      await deleteThemeAsset(assetId);
    },
    onSuccess: async (_data, assetId) => {
      queryClient.setQueryData<ThemeBackgroundAsset[]>(
        settingsQueryKeys.themeAssets(),
        (current) => {
          const next = current || [];
          return next.filter((item) => item.id !== assetId);
        },
      );
      await queryClient.invalidateQueries({ queryKey: settingsQueryKeys.themeAssets() });
    },
  });
}

export type { ThemeMode };
