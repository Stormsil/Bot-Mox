/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { theme, type ConfigProviderProps } from 'antd';
import {
  getThemeSettings,
  type ThemeSettings,
  getDefaultThemeSettings,
} from '../services/themeService';
import {
  applyThemePaletteToDocument,
  applyThemeShapeToDocument,
  applyThemeTypographyToDocument,
  sanitizeThemeVisualSettings,
  sanitizeThemeShapeSettings,
  sanitizeThemeTypographySettings,
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

function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

function buildThemeConfig(
  mode: ThemeMode,
  palettes: ThemePalettes,
  typography: ThemeTypographySettings,
  shape: ThemeShapeSettings
): AntThemeConfig {
  const isDark = mode === 'dark';
  const palette = palettes[mode];
  const safeTypography = sanitizeThemeTypographySettings(typography);
  const safeShape = sanitizeThemeShapeSettings(shape);

  return {
    algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      // Keep typography in sync with the app shell.
      fontFamily: safeTypography.fontPrimary,
      fontFamilyCode: safeTypography.fontMono,
      fontSize: 13,
      colorPrimary: palette['--boxmox-color-brand-primary'],
      colorPrimaryHover: palette['--boxmox-color-brand-primary-hover'],
      colorPrimaryActive: palette['--boxmox-color-brand-contrast'],
      colorBgBase: palette['--boxmox-color-surface-base'],
      colorBgContainer: palette['--boxmox-color-surface-panel'],
      colorBgElevated: palette['--boxmox-color-surface-panel'],
      colorTextBase: palette['--boxmox-color-text-primary'],
      colorTextSecondary: palette['--boxmox-color-text-secondary'],
      colorTextPlaceholder: palette['--boxmox-color-text-muted'],
      colorBorder: palette['--boxmox-color-border-default'],
      controlOutline: 'rgba(var(--boxmox-color-brand-primary-rgb), 0.22)',
      borderRadius: safeShape.radiusMd,
      borderRadiusSM: safeShape.radiusSm,
      borderRadiusLG: safeShape.radiusLg,
      wireframe: false,
    },
    components: {
      Layout: {
        headerBg: palette['--boxmox-color-header-bg'],
        bodyBg: palette['--boxmox-color-surface-base'],
        siderBg: palette['--boxmox-color-surface-panel'],
      },
      Card: {
        colorBgContainer: palette['--boxmox-color-surface-panel'],
        headerBg: palette['--boxmox-color-surface-muted'],
      },
      Table: {
        colorBgContainer: palette['--boxmox-color-surface-panel'],
        headerBg: palette['--boxmox-color-surface-muted'],
      },
      Input: {
        colorBgContainer: palette['--boxmox-color-surface-muted'],
        hoverBorderColor: palette['--boxmox-color-brand-primary'],
        activeBorderColor: palette['--boxmox-color-brand-primary'],
      },
      InputNumber: {
        colorBgContainer: palette['--boxmox-color-surface-muted'],
        hoverBorderColor: palette['--boxmox-color-brand-primary'],
        activeBorderColor: palette['--boxmox-color-brand-primary'],
      },
      Select: {
        colorBgContainer: palette['--boxmox-color-surface-muted'],
        optionActiveBg: palette['--boxmox-color-surface-hover'],
        optionSelectedBg: palette['--boxmox-color-brand-primary'],
        optionSelectedColor: '#ffffff',
      },
      DatePicker: {
        colorBgContainer: palette['--boxmox-color-surface-muted'],
        hoverBorderColor: palette['--boxmox-color-brand-primary'],
        activeBorderColor: palette['--boxmox-color-brand-primary'],
        colorTextPlaceholder: palette['--boxmox-color-text-muted'],
      },
      Form: {
        labelColor: palette['--boxmox-color-text-secondary'],
      },
      Modal: {
        contentBg: palette['--boxmox-color-surface-panel'],
        headerBg: palette['--boxmox-color-surface-muted'],
      },
      Drawer: {
        colorBgElevated: palette['--boxmox-color-surface-panel'],
      },
      Tooltip: {
        colorBgSpotlight: palette['--boxmox-color-surface-panel'],
      },
      Tree: {
        nodeHoverBg: 'transparent',
        nodeHoverColor: palette['--boxmox-color-text-primary'],
        nodeSelectedBg: 'transparent',
        nodeSelectedColor: palette['--boxmox-color-text-primary'],
      },
      Segmented: {
        trackBg: palette['--boxmox-color-surface-panel'],
        trackPadding: 2,
        itemColor: palette['--boxmox-color-text-secondary'],
        itemHoverColor: palette['--boxmox-color-text-primary'],
        itemHoverBg: palette['--boxmox-color-surface-hover'],
        itemActiveBg: palette['--boxmox-color-surface-muted'],
        itemSelectedBg: palette['--boxmox-color-surface-muted'],
        itemSelectedColor: palette['--boxmox-color-text-primary'],
      },
      Menu: {
        itemBg: 'transparent',
        itemColor: palette['--boxmox-color-text-secondary'],
        itemHoverBg: palette['--boxmox-color-surface-hover'],
        itemHoverColor: palette['--boxmox-color-text-primary'],
        itemSelectedBg: palette['--boxmox-color-brand-soft'],
        itemSelectedColor: palette['--boxmox-color-brand-contrast'],
        itemActiveBg: palette['--boxmox-color-surface-hover'],
        itemHeight: 40,
        itemMarginInline: 0,
        itemMarginBlock: 0,
        itemPaddingInline: 0,
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
    () => buildThemeConfig(themeMode, themeSettings.palettes, themeSettings.typography, themeSettings.shape),
    [themeMode, themeSettings.palettes, themeSettings.typography, themeSettings.shape]
  );

  const value: ThemeRuntimeContextValue = useMemo(() => ({
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
  }), [themeMode, themeSettings, themeConfig]);

  return (
    <ThemeRuntimeContext.Provider value={value}>
      {children}
    </ThemeRuntimeContext.Provider>
  );
};

export function useThemeRuntime(): ThemeRuntimeContextValue {
  const context = useContext(ThemeRuntimeContext);
  if (!context) {
    throw new Error('useThemeRuntime must be used inside ThemeRuntimeProvider');
  }
  return context;
}
