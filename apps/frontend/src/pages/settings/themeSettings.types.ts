import type {
  ThemeBackgroundAsset,
  ThemePreset,
  ThemeSettings,
} from '../../entities/settings/api/themeFacade';
import type {
  ThemeColorVariable,
  ThemeMode,
  ThemePalettes,
  ThemeShapeSettings,
  ThemeTypographySettings,
  ThemeVisualSettings,
} from '../../theme/themePalette';

export type { ThemeBackgroundAsset, ThemePreset, ThemeSettings };
export type {
  ThemeColorVariable,
  ThemeMode,
  ThemePalettes,
  ThemeShapeSettings,
  ThemeTypographySettings,
  ThemeVisualSettings,
};

export interface UseThemeSettingsArgs {
  themePalettes?: ThemePalettes;
  onThemePalettesChange?: (palettes: ThemePalettes) => void;
  visualSettings?: ThemeVisualSettings;
  onVisualSettingsChange?: (visual: ThemeVisualSettings) => void;
  typographySettings?: ThemeTypographySettings;
  onTypographySettingsChange?: (typography: ThemeTypographySettings) => void;
  shapeSettings?: ThemeShapeSettings;
  onShapeSettingsChange?: (shape: ThemeShapeSettings) => void;
}

export interface UseThemeSettingsResult {
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
    options?: { syncApp?: boolean },
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
