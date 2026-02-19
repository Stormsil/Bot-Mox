import type { ThemeBackgroundAsset } from '../../entities/settings/model/theme';
import type {
  ThemeColorVariable,
  ThemeMode,
  ThemePalettes,
  ThemeShapeSettings,
  ThemeTypographySettings,
  ThemeVisualSettings,
} from '../../theme/themePalette';

export interface ThemeSettingsPanelProps {
  selectedPresetId?: string;
  themePresetOptions: Array<{ label: string; value: string }>;
  onSelectedPresetChange: (value?: string) => void;
  onOpenThemeEditor: () => void;
  onApplySelectedPreset: () => void;
  themePresetApplying: boolean;

  isThemeDrawerOpen: boolean;
  onCloseThemeEditor: () => void;
  themeSaving: boolean;
  onSaveThemeColors: () => void;

  onDeleteSelectedPreset: () => void;
  themePresetDeleting: boolean;
  newThemePresetName: string;
  onNewThemePresetNameChange: (value: string) => void;
  onSaveCurrentAsPreset: () => void;
  themePresetSaving: boolean;

  editingThemeMode: ThemeMode;
  onEditingThemeModeChange: (mode: ThemeMode) => void;
  onResetCurrentPalette: () => void;

  localThemePalettes: ThemePalettes;
  themeInputValues: ThemePalettes;
  onThemeColorChange: (
    mode: ThemeMode,
    cssVar: ThemeColorVariable,
    rawColor: string,
    options?: { syncApp?: boolean },
  ) => void;
  onThemeInputChange: (mode: ThemeMode, cssVar: ThemeColorVariable, value: string) => void;
  onThemeInputCommit: (mode: ThemeMode, cssVar: ThemeColorVariable) => void;
  onPickColorFromScreen: (mode: ThemeMode, cssVar: ThemeColorVariable) => Promise<void> | void;

  localTypographySettings: ThemeTypographySettings;
  localShapeSettings: ThemeShapeSettings;
  onTypographySettingsChange: (patch: Partial<ThemeTypographySettings>) => void;
  onShapeSettingsChange: (patch: Partial<ThemeShapeSettings>) => void;

  localVisualSettings: ThemeVisualSettings;
  themeAssets: ThemeBackgroundAsset[];
  themeAssetsLoading: boolean;
  themeAssetUploading: boolean;
  onRefreshThemeAssets: () => Promise<void> | void;
  onUploadThemeAsset: (file: File) => Promise<void> | void;
  onSelectThemeBackground: (assetId?: string) => void;
  onDeleteThemeAsset: (assetId: string) => Promise<void> | void;
  onVisualSettingsChange: (patch: Partial<ThemeVisualSettings>) => void;
  onSaveVisualSettings: () => Promise<void> | void;
}
