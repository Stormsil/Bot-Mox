import { useEffect } from 'react';
import {
  sanitizeThemeShapeSettings,
  sanitizeThemeTypographySettings,
  sanitizeThemeVisualSettings,
} from '../../theme/themePalette';
import { cloneThemePalettes } from './themeSettings.helpers';
import type {
  ThemePalettes,
  ThemeShapeSettings,
  ThemeTypographySettings,
  ThemeVisualSettings,
} from './themeSettings.types';

interface UseThemeSettingsSyncParams {
  themePalettes?: ThemePalettes;
  visualSettings?: ThemeVisualSettings;
  typographySettings?: ThemeTypographySettings;
  shapeSettings?: ThemeShapeSettings;
  setLocalThemePalettes: (value: ThemePalettes) => void;
  setThemeInputValues: (value: ThemePalettes) => void;
  setLocalVisualSettings: (value: ThemeVisualSettings) => void;
  setLocalTypographySettings: (value: ThemeTypographySettings) => void;
  setLocalShapeSettings: (value: ThemeShapeSettings) => void;
}

export function useThemeSettingsSync(params: UseThemeSettingsSyncParams): void {
  useEffect(() => {
    if (!params.themePalettes) return;
    const cloned = cloneThemePalettes(params.themePalettes);
    params.setLocalThemePalettes(cloned);
    params.setThemeInputValues(cloned);
  }, [params.themePalettes, params.setLocalThemePalettes, params.setThemeInputValues]);

  useEffect(() => {
    params.setLocalVisualSettings(sanitizeThemeVisualSettings(params.visualSettings));
  }, [params.visualSettings, params.setLocalVisualSettings]);

  useEffect(() => {
    params.setLocalTypographySettings(sanitizeThemeTypographySettings(params.typographySettings));
  }, [params.typographySettings, params.setLocalTypographySettings]);

  useEffect(() => {
    params.setLocalShapeSettings(sanitizeThemeShapeSettings(params.shapeSettings));
  }, [params.shapeSettings, params.setLocalShapeSettings]);
}
