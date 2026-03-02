export type ThemeMode = 'light' | 'dark';

export const THEME_COLOR_DEFINITIONS = [
  { cssVar: '--botmox-color-surface-base', label: 'Surface / Base' },
  { cssVar: '--botmox-color-surface-panel', label: 'Surface / Panel' },
  { cssVar: '--botmox-color-surface-muted', label: 'Surface / Muted' },
  { cssVar: '--botmox-color-surface-hover', label: 'Surface / Hover' },
  { cssVar: '--botmox-color-surface-active', label: 'Surface / Active' },
  { cssVar: '--botmox-color-brand-primary', label: 'Brand / Primary' },
  { cssVar: '--botmox-color-brand-primary-hover', label: 'Brand / Primary Hover' },
  { cssVar: '--botmox-color-brand-soft', label: 'Brand / Soft' },
  { cssVar: '--botmox-color-brand-contrast', label: 'Brand / Contrast' },
  { cssVar: '--botmox-color-brand-warning', label: 'Brand / Warning Accent' },
  { cssVar: '--botmox-color-text-primary', label: 'Text / Primary' },
  { cssVar: '--botmox-color-text-secondary', label: 'Text / Secondary' },
  { cssVar: '--botmox-color-text-muted', label: 'Text / Muted' },
  { cssVar: '--botmox-color-text-strong', label: 'Text / Strong' },
  { cssVar: '--botmox-color-status-success', label: 'Status / Success' },
  { cssVar: '--botmox-color-status-neutral', label: 'Status / Neutral' },
  { cssVar: '--botmox-color-status-warning', label: 'Status / Warning' },
  { cssVar: '--botmox-color-status-danger', label: 'Status / Danger' },
  { cssVar: '--botmox-color-status-info', label: 'Status / Info' },
  { cssVar: '--botmox-color-status-paused', label: 'Status / Paused' },
  { cssVar: '--botmox-color-border-default', label: 'Border / Default' },
  { cssVar: '--botmox-color-border-subtle', label: 'Border / Subtle' },
  { cssVar: '--botmox-color-border-strong', label: 'Border / Strong' },
  { cssVar: '--botmox-color-header-bg', label: 'Header / Background' },
  { cssVar: '--botmox-color-header-border', label: 'Header / Border' },
  { cssVar: '--botmox-color-header-text', label: 'Header / Text' },
  { cssVar: '--botmox-color-header-text-muted', label: 'Header / Text Muted' },
  { cssVar: '--botmox-color-header-hover', label: 'Header / Hover' },
] as const;

export type ThemeColorVariable = (typeof THEME_COLOR_DEFINITIONS)[number]['cssVar'];
export type ThemePalette = Record<ThemeColorVariable, string>;
export type ThemePalettes = Record<ThemeMode, ThemePalette>;
export type ThemeVisualMode = 'none' | 'image';
export type ThemeVisualPosition = 'center' | 'top' | 'custom';
export type ThemeVisualSize = 'cover' | 'contain' | 'auto';

export interface ThemeVisualSettings {
  enabled: boolean;
  mode: ThemeVisualMode;
  backgroundAssetId?: string;
  backgroundImageUrl?: string;
  backgroundPosition: ThemeVisualPosition;
  backgroundSize: ThemeVisualSize;
  overlayOpacity: number;
  overlayColorLight: string;
  overlayColorDark: string;
  blurPx: number;
  dimStrength: number;
}

export interface ThemeTypographySettings {
  fontPrimary: string;
  fontCondensed: string;
  fontMono: string;
}

export interface ThemeShapeSettings {
  radiusNone: number;
  radiusSm: number;
  radiusMd: number;
  radiusLg: number;
}

export const COMPAT_THEME_COLOR_KEYS: Record<ThemeColorVariable, string[]> = {
  '--botmox-color-surface-base': ['--proxmox-bg-primary', '--proxmox-bg'],
  '--botmox-color-surface-panel': ['--proxmox-bg-secondary', '--proxmox-card-bg'],
  '--botmox-color-surface-muted': ['--proxmox-bg-tertiary'],
  '--botmox-color-surface-hover': ['--proxmox-bg-hover'],
  '--botmox-color-surface-active': ['--proxmox-bg-active'],
  '--botmox-color-brand-primary': ['--proxmox-accent', '--proxmox-primary'],
  '--botmox-color-brand-primary-hover': ['--proxmox-accent-hover', '--proxmox-primary-hover'],
  '--botmox-color-brand-soft': ['--proxmox-accent-light'],
  '--botmox-color-brand-contrast': ['--proxmox-accent-strong'],
  '--botmox-color-brand-warning': ['--proxmox-orange'],
  '--botmox-color-text-primary': ['--proxmox-text-primary'],
  '--botmox-color-text-secondary': ['--proxmox-text-secondary'],
  '--botmox-color-text-muted': ['--proxmox-text-muted'],
  '--botmox-color-text-strong': ['--proxmox-text-dark'],
  '--botmox-color-status-success': ['--proxmox-status-online', '--proxmox-success'],
  '--botmox-color-status-neutral': ['--proxmox-status-offline'],
  '--botmox-color-status-warning': ['--proxmox-status-warning', '--proxmox-warning'],
  '--botmox-color-status-danger': ['--proxmox-status-error'],
  '--botmox-color-status-info': ['--proxmox-status-info'],
  '--botmox-color-status-paused': ['--proxmox-status-paused'],
  '--botmox-color-border-default': ['--proxmox-border'],
  '--botmox-color-border-subtle': ['--proxmox-border-light'],
  '--botmox-color-border-strong': ['--proxmox-border-dark'],
  '--botmox-color-header-bg': ['--vsphere-header-bg'],
  '--botmox-color-header-border': ['--vsphere-header-border'],
  '--botmox-color-header-text': ['--vsphere-header-text'],
  '--botmox-color-header-text-muted': ['--vsphere-header-muted'],
  '--botmox-color-header-hover': ['--vsphere-header-hover'],
};

export const DEFAULT_LIGHT_THEME_PALETTE: ThemePalette = {
  '--botmox-color-surface-base': '#f2f4f7',
  '--botmox-color-surface-panel': '#ffffff',
  '--botmox-color-surface-muted': '#e9edf2',
  '--botmox-color-surface-hover': '#e1e8f1',
  '--botmox-color-surface-active': '#d5e0ee',
  '--botmox-color-brand-primary': '#3b7db8',
  '--botmox-color-brand-primary-hover': '#2f6b9f',
  '--botmox-color-brand-soft': '#d6e6f7',
  '--botmox-color-brand-contrast': '#1f4f6f',
  '--botmox-color-brand-warning': '#f59a23',
  '--botmox-color-text-primary': '#26323b',
  '--botmox-color-text-secondary': '#4b5a66',
  '--botmox-color-text-muted': '#7b8793',
  '--botmox-color-text-strong': '#1a1f24',
  '--botmox-color-status-success': '#2ecc71',
  '--botmox-color-status-neutral': '#7f8c8d',
  '--botmox-color-status-warning': '#f39c12',
  '--botmox-color-status-danger': '#e74c3c',
  '--botmox-color-status-info': '#3498db',
  '--botmox-color-status-paused': '#f1c40f',
  '--botmox-color-border-default': '#d4dbe3',
  '--botmox-color-border-subtle': '#e4e9ef',
  '--botmox-color-border-strong': '#bcc6d1',
  '--botmox-color-header-bg': '#2c3e50',
  '--botmox-color-header-border': '#21313f',
  '--botmox-color-header-text': '#e6edf3',
  '--botmox-color-header-text-muted': '#a9b6c3',
  '--botmox-color-header-hover': '#344a5e',
};

export const DEFAULT_DARK_THEME_PALETTE: ThemePalette = {
  '--botmox-color-surface-base': '#1e1f22',
  '--botmox-color-surface-panel': '#2a2f35',
  '--botmox-color-surface-muted': '#31363d',
  '--botmox-color-surface-hover': '#3a414a',
  '--botmox-color-surface-active': '#444c56',
  '--botmox-color-brand-primary': '#4a90d6',
  '--botmox-color-brand-primary-hover': '#5aa0e0',
  '--botmox-color-brand-soft': '#233a4f',
  '--botmox-color-brand-contrast': '#cfe2f4',
  '--botmox-color-brand-warning': '#f2a93b',
  '--botmox-color-text-primary': '#e6edf3',
  '--botmox-color-text-secondary': '#b9c3cd',
  '--botmox-color-text-muted': '#8e9aa6',
  '--botmox-color-text-strong': '#f4f7fa',
  '--botmox-color-status-success': '#2ecc71',
  '--botmox-color-status-neutral': '#7f8c8d',
  '--botmox-color-status-warning': '#f39c12',
  '--botmox-color-status-danger': '#e74c3c',
  '--botmox-color-status-info': '#3498db',
  '--botmox-color-status-paused': '#f1c40f',
  '--botmox-color-border-default': '#3a424a',
  '--botmox-color-border-subtle': '#4a545e',
  '--botmox-color-border-strong': '#23282f',
  '--botmox-color-header-bg': '#1f2a33',
  '--botmox-color-header-border': '#182129',
  '--botmox-color-header-text': '#e6edf3',
  '--botmox-color-header-text-muted': '#97a6b4',
  '--botmox-color-header-hover': '#2a3945',
};

export const createDefaultThemePalettes = (): ThemePalettes => ({
  light: { ...DEFAULT_LIGHT_THEME_PALETTE },
  dark: { ...DEFAULT_DARK_THEME_PALETTE },
});

export const DEFAULT_THEME_TYPOGRAPHY_SETTINGS: ThemeTypographySettings = {
  fontPrimary: "'Roboto', 'Segoe UI', sans-serif",
  fontCondensed: "'Roboto Condensed', sans-serif",
  fontMono: "'Roboto Mono', monospace",
};

export const DEFAULT_THEME_SHAPE_SETTINGS: ThemeShapeSettings = {
  radiusNone: 0,
  radiusSm: 2,
  radiusMd: 4,
  radiusLg: 6,
};

export const DEFAULT_THEME_VISUAL_SETTINGS: ThemeVisualSettings = {
  enabled: false,
  mode: 'none',
  backgroundAssetId: undefined,
  backgroundImageUrl: undefined,
  backgroundPosition: 'center',
  backgroundSize: 'cover',
  overlayOpacity: 0.42,
  overlayColorLight: '#f2f4f7',
  overlayColorDark: '#121518',
  blurPx: 2,
  dimStrength: 0.2,
};
