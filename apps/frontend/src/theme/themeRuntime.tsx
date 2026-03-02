/* eslint-disable react-refresh/only-export-components */

import { type ConfigProviderProps, theme } from 'antd';
import type React from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  getDefaultThemeSettings,
  getThemeSettings,
  type ThemeSettings,
} from '../entities/settings/api/themeFacade';
import {
  applyThemePaletteToDocument,
  applyThemeShapeToDocument,
  applyThemeTypographyToDocument,
  sanitizeThemeShapeSettings,
  sanitizeThemeTypographySettings,
  sanitizeThemeVisualSettings,
  type ThemeMode,
  type ThemePalettes,
  type ThemeShapeSettings,
  type ThemeTypographySettings,
  type ThemeVisualSettings,
} from './themePalette';

const THEME_STORAGE_KEY = 'botmox_theme';

type AntThemeConfig = ConfigProviderProps['theme'];

interface ThemeRuntimeContextValue {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  themeSettings: ThemeSettings;
  setThemeSettings: React.Dispatch<React.SetStateAction<ThemeSettings>>;
  themePalettes: ThemePalettes;
  visualSettings: ThemeVisualSettings;
  typographySettings: ThemeTypographySettings;
  shapeSettings: ThemeShapeSettings;
  setThemePalettes: (palettes: ThemePalettes) => void;
  setVisualSettings: (visual: ThemeVisualSettings) => void;
  setTypographySettings: (typography: ThemeTypographySettings) => void;
  setShapeSettings: (shape: ThemeShapeSettings) => void;
  themeConfig: AntThemeConfig;
}

const ThemeRuntimeContext = createContext<ThemeRuntimeContextValue | null>(null);

type ThemeSpacingScale = {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
};

const DEFAULT_THEME_SPACING: ThemeSpacingScale = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

function readSpacingScaleFromCssVars(): ThemeSpacingScale {
  if (typeof window === 'undefined') {
    return DEFAULT_THEME_SPACING;
  }

  const rootStyles = window.getComputedStyle(document.documentElement);
  const read = (name: string, fallback: number): number => {
    const parsed = Number.parseFloat(rootStyles.getPropertyValue(name).trim());
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  return {
    xs: read('--botmox-space-xs', DEFAULT_THEME_SPACING.xs),
    sm: read('--botmox-space-sm', DEFAULT_THEME_SPACING.sm),
    md: read('--botmox-space-md', DEFAULT_THEME_SPACING.md),
    lg: read('--botmox-space-lg', DEFAULT_THEME_SPACING.lg),
    xl: read('--botmox-space-xl', DEFAULT_THEME_SPACING.xl),
  };
}

function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }
  if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

function buildThemeConfig(
  mode: ThemeMode,
  palettes: ThemePalettes,
  typography: ThemeTypographySettings,
  shape: ThemeShapeSettings,
): AntThemeConfig {
  const isDark = mode === 'dark';
  const palette = palettes[mode];
  const safeTypography = sanitizeThemeTypographySettings(typography);
  const safeShape = sanitizeThemeShapeSettings(shape);
  const spacing = readSpacingScaleFromCssVars();

  return {
    algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      // Keep typography in sync with the app shell.
      fontFamily: safeTypography.fontPrimary,
      fontFamilyCode: safeTypography.fontMono,
      fontSize: 13,
      colorPrimary: palette['--botmox-color-brand-primary'],
      colorPrimaryHover: palette['--botmox-color-brand-primary-hover'],
      colorPrimaryActive: palette['--botmox-color-brand-contrast'],
      colorBgBase: palette['--botmox-color-surface-base'],
      colorBgContainer: palette['--botmox-color-surface-panel'],
      colorBgElevated: palette['--botmox-color-surface-panel'],
      colorTextBase: palette['--botmox-color-text-primary'],
      colorTextSecondary: palette['--botmox-color-text-secondary'],
      colorTextPlaceholder: palette['--botmox-color-text-muted'],
      colorBorder: palette['--botmox-color-border-default'],
      colorFillContent: palette['--botmox-color-surface-muted'],
      colorFillContentHover: palette['--botmox-color-surface-hover'],
      controlOutline: 'rgba(var(--botmox-color-brand-primary-rgb), 0.22)',
      borderRadius: 0,
      borderRadiusSM: 0,
      borderRadiusLG: 0,
      borderRadiusXS: 0,
      borderRadiusOuter: 0,
      boxShadow: 'none',
      wireframe: true,
      paddingXS: spacing.xs,
      paddingSM: spacing.sm,
      padding: spacing.md,
      paddingLG: spacing.lg,
      paddingXL: spacing.xl,
      marginXS: spacing.xs,
      marginSM: spacing.sm,
      margin: spacing.md,
      marginLG: spacing.lg,
      marginXL: spacing.xl,
    },
    components: {
      Layout: {
        headerBg: palette['--botmox-color-header-bg'],
        bodyBg: palette['--botmox-color-surface-base'],
        siderBg: palette['--botmox-color-surface-panel'],
      },
      Card: {
        colorBgContainer: palette['--botmox-color-surface-panel'],
        headerBg: palette['--botmox-color-surface-muted'],
      },
      Table: {
        colorBgContainer: palette['--botmox-color-surface-panel'],
        headerBg: palette['--botmox-color-surface-muted'],
      },
      Pagination: {
        itemBg: palette['--botmox-color-surface-muted'],
        itemActiveBg: palette['--botmox-color-brand-primary'],
        itemActiveColor: palette['--botmox-color-brand-contrast'],
        itemActiveColorHover: palette['--botmox-color-brand-contrast'],
        itemLinkBg: palette['--botmox-color-surface-muted'],
        itemInputBg: palette['--botmox-color-surface-muted'],
      },
      Input: {
        colorBgContainer: palette['--botmox-color-surface-muted'],
        hoverBorderColor: palette['--botmox-color-brand-primary'],
        activeBorderColor: palette['--botmox-color-brand-primary'],
      },
      InputNumber: {
        colorBgContainer: palette['--botmox-color-surface-muted'],
        hoverBorderColor: palette['--botmox-color-brand-primary'],
        activeBorderColor: palette['--botmox-color-brand-primary'],
      },
      Select: {
        colorBgContainer: palette['--botmox-color-surface-muted'],
        optionActiveBg: palette['--botmox-color-surface-hover'],
        optionSelectedBg: palette['--botmox-color-brand-primary'],
        optionSelectedColor: '#ffffff',
      },
      DatePicker: {
        colorBgContainer: palette['--botmox-color-surface-muted'],
        hoverBorderColor: palette['--botmox-color-brand-primary'],
        activeBorderColor: palette['--botmox-color-brand-primary'],
        colorTextPlaceholder: palette['--botmox-color-text-muted'],
      },
      Form: {
        labelColor: palette['--botmox-color-text-secondary'],
      },
      Modal: {
        contentBg: palette['--botmox-color-surface-panel'],
        headerBg: palette['--botmox-color-surface-muted'],
        footerBg: palette['--botmox-color-surface-muted'],
        titleColor: palette['--botmox-color-text-primary'],
        colorText: palette['--botmox-color-text-primary'],
        borderRadius: safeShape.radiusMd,
        boxShadow: '0 20px 54px rgba(0, 0, 0, 0.35)',
      },
      Drawer: {
        colorBgElevated: palette['--botmox-color-surface-panel'],
      },
      Tooltip: {
        colorBgSpotlight: palette['--botmox-color-surface-panel'],
      },
      Tree: {
        nodeHoverBg: 'transparent',
        nodeHoverColor: palette['--botmox-color-text-primary'],
        nodeSelectedBg: 'transparent',
        nodeSelectedColor: palette['--botmox-color-text-primary'],
      },
      Segmented: {
        trackBg: palette['--botmox-color-surface-panel'],
        trackPadding: 2,
        itemColor: palette['--botmox-color-text-secondary'],
        itemHoverColor: palette['--botmox-color-text-primary'],
        itemHoverBg: palette['--botmox-color-surface-hover'],
        itemActiveBg: palette['--botmox-color-surface-muted'],
        itemSelectedBg: palette['--botmox-color-surface-muted'],
        itemSelectedColor: palette['--botmox-color-text-primary'],
      },
      Checkbox: {
        colorBgContainer: palette['--botmox-color-surface-muted'],
      },
      Menu: {
        itemBg: 'transparent',
        itemColor: palette['--botmox-color-text-secondary'],
        itemHoverBg: palette['--botmox-color-surface-hover'],
        itemHoverColor: palette['--botmox-color-text-primary'],
        itemSelectedBg: palette['--botmox-color-brand-soft'],
        itemSelectedColor: palette['--botmox-color-brand-contrast'],
        itemActiveBg: palette['--botmox-color-surface-hover'],
        itemHeight: 40,
        itemMarginInline: 0,
        itemMarginBlock: 0,
        itemPaddingInline: 0,
      },
      Button: {
        defaultShadow: 'none',
        primaryShadow: 'none',
      },
    },
  };
}

export const ThemeRuntimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialTheme);
  const [themeSettings, setThemeSettings] = useState<ThemeSettings>(getDefaultThemeSettings);

  useEffect(() => {
    let isMounted = true;

    getThemeSettings()
      .then((settings) => {
        if (!isMounted) return;
        setThemeSettings(settings);
      })
      .catch((error) => {
        console.error('Error loading theme settings:', error);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeMode);
    document.documentElement.style.colorScheme = themeMode;
    localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    applyThemePaletteToDocument(themeSettings.palettes[themeMode]);
    applyThemeTypographyToDocument(themeSettings.typography);
    applyThemeShapeToDocument(themeSettings.shape);
  }, [themeMode, themeSettings.palettes, themeSettings.typography, themeSettings.shape]);

  const themeConfig = useMemo(
    () =>
      buildThemeConfig(
        themeMode,
        themeSettings.palettes,
        themeSettings.typography,
        themeSettings.shape,
      ),
    [themeMode, themeSettings.palettes, themeSettings.typography, themeSettings.shape],
  );

  const value: ThemeRuntimeContextValue = useMemo(
    () => ({
      themeMode,
      setThemeMode,
      themeSettings,
      setThemeSettings,
      themePalettes: themeSettings.palettes,
      visualSettings: sanitizeThemeVisualSettings(themeSettings.visual),
      typographySettings: sanitizeThemeTypographySettings(themeSettings.typography),
      shapeSettings: sanitizeThemeShapeSettings(themeSettings.shape),
      setThemePalettes: (palettes) => {
        setThemeSettings((current) => ({
          ...current,
          palettes,
        }));
      },
      setVisualSettings: (visual) => {
        setThemeSettings((current) => ({
          ...current,
          visual: sanitizeThemeVisualSettings(visual),
        }));
      },
      setTypographySettings: (typography) => {
        setThemeSettings((current) => ({
          ...current,
          typography: sanitizeThemeTypographySettings(typography),
        }));
      },
      setShapeSettings: (shape) => {
        setThemeSettings((current) => ({
          ...current,
          shape: sanitizeThemeShapeSettings(shape),
        }));
      },
      themeConfig,
    }),
    [themeMode, themeSettings, themeConfig],
  );

  return <ThemeRuntimeContext.Provider value={value}>{children}</ThemeRuntimeContext.Provider>;
};

export function useThemeRuntime(): ThemeRuntimeContextValue {
  const context = useContext(ThemeRuntimeContext);
  if (!context) {
    throw new Error('useThemeRuntime must be used inside ThemeRuntimeProvider');
  }
  return context;
}
