import type { ThemePalettes, ThemePreset } from './themeSettings.types';

export interface EyeDropperOpenResult {
  sRGBHex: string;
}

export interface EyeDropperApi {
  open: () => Promise<EyeDropperOpenResult>;
}

export interface WindowWithEyeDropper extends Window {
  EyeDropper?: new () => EyeDropperApi;
}

export const cloneThemePalettes = (palettes: ThemePalettes): ThemePalettes => ({
  light: { ...palettes.light },
  dark: { ...palettes.dark },
});

export const mapThemePresetsToList = (presets: Record<string, ThemePreset>): ThemePreset[] =>
  Object.values(presets).sort((a, b) => b.updated_at - a.updated_at);
