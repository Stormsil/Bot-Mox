import type React from 'react';
import { useEffect, useRef } from 'react';
import { useThemeRuntime } from '../../../theme/themeRuntime';
import { ThemeSettingsPanel } from '../ThemeSettingsPanel';
import type { ThemeSettings } from '../themeSettings.types';
import { useThemeSettings } from '../useThemeSettings';

interface ThemeSettingsContainerProps {
  themeSettings?: ThemeSettings | null;
}

export const ThemeSettingsContainer: React.FC<ThemeSettingsContainerProps> = ({
  themeSettings,
}) => {
  const {
    themePalettes,
    setThemePalettes,
    visualSettings,
    setVisualSettings,
    typographySettings,
    setTypographySettings,
    shapeSettings,
    setShapeSettings,
  } = useThemeRuntime();

  const theme = useThemeSettings({
    themePalettes,
    onThemePalettesChange: setThemePalettes,
    visualSettings,
    onVisualSettingsChange: setVisualSettings,
    typographySettings,
    onTypographySettingsChange: setTypographySettings,
    shapeSettings,
    onShapeSettingsChange: setShapeSettings,
  });

  const applyThemeSettingsRef = useRef(theme.applyThemeSettings);
  const appliedThemeSettingsKeyRef = useRef<string | null>(null);

  useEffect(() => {
    applyThemeSettingsRef.current = theme.applyThemeSettings;
  }, [theme.applyThemeSettings]);

  useEffect(() => {
    if (!themeSettings) {
      appliedThemeSettingsKeyRef.current = null;
      return;
    }

    const nextThemeSettingsKey = JSON.stringify(themeSettings);
    if (appliedThemeSettingsKeyRef.current === nextThemeSettingsKey) {
      return;
    }

    appliedThemeSettingsKeyRef.current = nextThemeSettingsKey;
    applyThemeSettingsRef.current(themeSettings);
  }, [themeSettings]);

  return (
    <ThemeSettingsPanel
      selectedPresetId={theme.selectedPresetId}
      themePresetOptions={theme.themePresetOptions}
      onSelectedPresetChange={theme.setSelectedPresetId}
      onOpenThemeEditor={() => theme.setIsThemeDrawerOpen(true)}
      onApplySelectedPreset={theme.handleApplySelectedPreset}
      themePresetApplying={theme.themePresetApplying}
      isThemeDrawerOpen={theme.isThemeDrawerOpen}
      onCloseThemeEditor={() => theme.setIsThemeDrawerOpen(false)}
      themeSaving={theme.themeSaving}
      onSaveThemeColors={theme.handleSaveThemeColors}
      onDeleteSelectedPreset={theme.handleDeleteSelectedPreset}
      themePresetDeleting={theme.themePresetDeleting}
      newThemePresetName={theme.newThemePresetName}
      onNewThemePresetNameChange={theme.setNewThemePresetName}
      onSaveCurrentAsPreset={theme.handleSaveCurrentAsPreset}
      themePresetSaving={theme.themePresetSaving}
      editingThemeMode={theme.editingThemeMode}
      onEditingThemeModeChange={theme.setEditingThemeMode}
      onResetCurrentPalette={theme.handleResetCurrentPalette}
      localThemePalettes={theme.localThemePalettes}
      themeInputValues={theme.themeInputValues}
      onThemeColorChange={theme.updateThemeColor}
      onThemeInputChange={theme.handleThemeInputChange}
      onThemeInputCommit={theme.commitThemeInput}
      onPickColorFromScreen={theme.handlePickColorFromScreen}
      localTypographySettings={theme.localTypographySettings}
      localShapeSettings={theme.localShapeSettings}
      onTypographySettingsChange={theme.handleTypographySettingsChange}
      onShapeSettingsChange={theme.handleShapeSettingsChange}
      localVisualSettings={theme.localVisualSettings}
      themeAssets={theme.themeAssets}
      themeAssetsLoading={theme.themeAssetsLoading}
      themeAssetUploading={theme.themeAssetUploading}
      onRefreshThemeAssets={theme.handleRefreshThemeAssets}
      onUploadThemeAsset={theme.handleUploadThemeAsset}
      onSelectThemeBackground={theme.handleSelectThemeBackground}
      onDeleteThemeAsset={theme.handleDeleteThemeAsset}
      onVisualSettingsChange={theme.handleVisualSettingsChange}
      onSaveVisualSettings={theme.handleSaveVisualSettings}
    />
  );
};
