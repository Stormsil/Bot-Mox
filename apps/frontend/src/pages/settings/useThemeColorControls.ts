import { message } from 'antd';
import { useCallback } from 'react';
import { uiLogger } from '../../observability/uiLogger';
import type { WindowWithEyeDropper } from './themeSettings.helpers';
import type { ThemeColorVariable, ThemeMode, ThemePalettes } from './themeSettings.types';
import { resetCurrentPaletteState, updateThemeColorState } from './themeSettingsStateActions';

interface UseThemeColorControlsParams {
  editingThemeMode: ThemeMode;
  defaultThemePalettes: ThemePalettes;
  themeInputValues: ThemePalettes;
  onThemePalettesChange?: ((palettes: ThemePalettes) => void) | undefined;
  setLocalThemePalettes: (
    value: ThemePalettes | ((current: ThemePalettes) => ThemePalettes),
  ) => void;
  setThemeInputValues: (value: ThemePalettes | ((current: ThemePalettes) => ThemePalettes)) => void;
}

interface UseThemeColorControlsResult {
  updateThemeColor: (
    mode: ThemeMode,
    cssVar: ThemeColorVariable,
    rawColor: string,
    options?: { syncApp?: boolean },
  ) => void;
  handleThemeInputChange: (mode: ThemeMode, cssVar: ThemeColorVariable, value: string) => void;
  commitThemeInput: (mode: ThemeMode, cssVar: ThemeColorVariable) => void;
  handlePickColorFromScreen: (mode: ThemeMode, cssVar: ThemeColorVariable) => Promise<void>;
  handleResetCurrentPalette: () => void;
}

export function useThemeColorControls(
  params: UseThemeColorControlsParams,
): UseThemeColorControlsResult {
  const updateThemeColor = useCallback(
    (
      mode: ThemeMode,
      cssVar: ThemeColorVariable,
      rawColor: string,
      options?: { syncApp?: boolean },
    ) => {
      const shouldSyncApp = options?.syncApp ?? true;
      updateThemeColorState({
        mode,
        cssVar,
        rawColor,
        defaultThemePalettes: params.defaultThemePalettes,
        setLocalThemePalettes: params.setLocalThemePalettes,
        setThemeInputValues: params.setThemeInputValues,
        onThemePalettesChange: params.onThemePalettesChange,
        shouldSyncApp,
      });
    },
    [params],
  );

  const handleThemeInputChange = useCallback(
    (mode: ThemeMode, cssVar: ThemeColorVariable, value: string) => {
      params.setThemeInputValues((current) => ({
        ...current,
        [mode]: {
          ...current[mode],
          [cssVar]: value,
        },
      }));
    },
    [params],
  );

  const commitThemeInput = useCallback(
    (mode: ThemeMode, cssVar: ThemeColorVariable) => {
      updateThemeColor(mode, cssVar, params.themeInputValues[mode][cssVar]);
    },
    [params.themeInputValues, updateThemeColor],
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
    resetCurrentPaletteState({
      editingThemeMode: params.editingThemeMode,
      defaultThemePalettes: params.defaultThemePalettes,
      setLocalThemePalettes: params.setLocalThemePalettes,
      setThemeInputValues: params.setThemeInputValues,
      onThemePalettesChange: params.onThemePalettesChange,
    });
  }, [params]);

  return {
    updateThemeColor,
    handleThemeInputChange,
    commitThemeInput,
    handlePickColorFromScreen,
    handleResetCurrentPalette,
  };
}
