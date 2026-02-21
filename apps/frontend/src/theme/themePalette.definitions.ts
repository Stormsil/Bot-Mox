export type ThemeMode = 'light' | 'dark';

export const THEME_COLOR_DEFINITIONS = [
  { cssVar: '--boxmox-color-surface-base', label: 'Surface / Base' },
  { cssVar: '--boxmox-color-surface-panel', label: 'Surface / Panel' },
  { cssVar: '--boxmox-color-surface-muted', label: 'Surface / Muted' },
  { cssVar: '--boxmox-color-surface-hover', label: 'Surface / Hover' },
  { cssVar: '--boxmox-color-surface-active', label: 'Surface / Active' },
  { cssVar: '--boxmox-color-brand-primary', label: 'Brand / Primary' },
  { cssVar: '--boxmox-color-brand-primary-hover', label: 'Brand / Primary Hover' },
  { cssVar: '--boxmox-color-brand-soft', label: 'Brand / Soft' },
  { cssVar: '--boxmox-color-brand-contrast', label: 'Brand / Contrast' },
  { cssVar: '--boxmox-color-brand-warning', label: 'Brand / Warning Accent' },
  { cssVar: '--boxmox-color-text-primary', label: 'Text / Primary' },
  { cssVar: '--boxmox-color-text-secondary', label: 'Text / Secondary' },
  { cssVar: '--boxmox-color-text-muted', label: 'Text / Muted' },
  { cssVar: '--boxmox-color-text-strong', label: 'Text / Strong' },
  { cssVar: '--boxmox-color-status-success', label: 'Status / Success' },
  { cssVar: '--boxmox-color-status-neutral', label: 'Status / Neutral' },
  { cssVar: '--boxmox-color-status-warning', label: 'Status / Warning' },
  { cssVar: '--boxmox-color-status-danger', label: 'Status / Danger' },
  { cssVar: '--boxmox-color-status-info', label: 'Status / Info' },
  { cssVar: '--boxmox-color-status-paused', label: 'Status / Paused' },
  { cssVar: '--boxmox-color-border-default', label: 'Border / Default' },
  { cssVar: '--boxmox-color-border-subtle', label: 'Border / Subtle' },
  { cssVar: '--boxmox-color-border-strong', label: 'Border / Strong' },
  { cssVar: '--boxmox-color-header-bg', label: 'Header / Background' },
  { cssVar: '--boxmox-color-header-border', label: 'Header / Border' },
  { cssVar: '--boxmox-color-header-text', label: 'Header / Text' },
  { cssVar: '--boxmox-color-header-text-muted', label: 'Header / Text Muted' },
  { cssVar: '--boxmox-color-header-hover', label: 'Header / Hover' },
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
  '--boxmox-color-surface-base': ['--proxmox-bg-primary', '--proxmox-bg'],
  '--boxmox-color-surface-panel': ['--proxmox-bg-secondary', '--proxmox-card-bg'],
  '--boxmox-color-surface-muted': ['--proxmox-bg-tertiary'],
  '--boxmox-color-surface-hover': ['--proxmox-bg-hover'],
  '--boxmox-color-surface-active': ['--proxmox-bg-active'],
  '--boxmox-color-brand-primary': ['--proxmox-accent', '--proxmox-primary'],
  '--boxmox-color-brand-primary-hover': ['--proxmox-accent-hover', '--proxmox-primary-hover'],
  '--boxmox-color-brand-soft': ['--proxmox-accent-light'],
  '--boxmox-color-brand-contrast': ['--proxmox-accent-strong'],
  '--boxmox-color-brand-warning': ['--proxmox-orange'],
  '--boxmox-color-text-primary': ['--proxmox-text-primary'],
  '--boxmox-color-text-secondary': ['--proxmox-text-secondary'],
  '--boxmox-color-text-muted': ['--proxmox-text-muted'],
  '--boxmox-color-text-strong': ['--proxmox-text-dark'],
  '--boxmox-color-status-success': ['--proxmox-status-online', '--proxmox-success'],
  '--boxmox-color-status-neutral': ['--proxmox-status-offline'],
  '--boxmox-color-status-warning': ['--proxmox-status-warning', '--proxmox-warning'],
  '--boxmox-color-status-danger': ['--proxmox-status-error'],
  '--boxmox-color-status-info': ['--proxmox-status-info'],
  '--boxmox-color-status-paused': ['--proxmox-status-paused'],
  '--boxmox-color-border-default': ['--proxmox-border'],
  '--boxmox-color-border-subtle': ['--proxmox-border-light'],
  '--boxmox-color-border-strong': ['--proxmox-border-dark'],
  '--boxmox-color-header-bg': ['--vsphere-header-bg'],
  '--boxmox-color-header-border': ['--vsphere-header-border'],
  '--boxmox-color-header-text': ['--vsphere-header-text'],
  '--boxmox-color-header-text-muted': ['--vsphere-header-muted'],
  '--boxmox-color-header-hover': ['--vsphere-header-hover'],
};

export const DEFAULT_LIGHT_THEME_PALETTE: ThemePalette = {
  '--boxmox-color-surface-base': '#f2f4f7',
  '--boxmox-color-surface-panel': '#ffffff',
  '--boxmox-color-surface-muted': '#e9edf2',
  '--boxmox-color-surface-hover': '#e1e8f1',
  '--boxmox-color-surface-active': '#d5e0ee',
  '--boxmox-color-brand-primary': '#3b7db8',
  '--boxmox-color-brand-primary-hover': '#2f6b9f',
  '--boxmox-color-brand-soft': '#d6e6f7',
  '--boxmox-color-brand-contrast': '#1f4f6f',
  '--boxmox-color-brand-warning': '#f59a23',
  '--boxmox-color-text-primary': '#26323b',
  '--boxmox-color-text-secondary': '#4b5a66',
  '--boxmox-color-text-muted': '#7b8793',
  '--boxmox-color-text-strong': '#1a1f24',
  '--boxmox-color-status-success': '#2ecc71',
  '--boxmox-color-status-neutral': '#7f8c8d',
  '--boxmox-color-status-warning': '#f39c12',
  '--boxmox-color-status-danger': '#e74c3c',
  '--boxmox-color-status-info': '#3498db',
  '--boxmox-color-status-paused': '#f1c40f',
  '--boxmox-color-border-default': '#d4dbe3',
  '--boxmox-color-border-subtle': '#e4e9ef',
  '--boxmox-color-border-strong': '#bcc6d1',
  '--boxmox-color-header-bg': '#2c3e50',
  '--boxmox-color-header-border': '#21313f',
  '--boxmox-color-header-text': '#e6edf3',
  '--boxmox-color-header-text-muted': '#a9b6c3',
  '--boxmox-color-header-hover': '#344a5e',
};

export const DEFAULT_DARK_THEME_PALETTE: ThemePalette = {
  '--boxmox-color-surface-base': '#1e1f22',
  '--boxmox-color-surface-panel': '#2a2f35',
  '--boxmox-color-surface-muted': '#31363d',
  '--boxmox-color-surface-hover': '#3a414a',
  '--boxmox-color-surface-active': '#444c56',
  '--boxmox-color-brand-primary': '#4a90d6',
  '--boxmox-color-brand-primary-hover': '#5aa0e0',
  '--boxmox-color-brand-soft': '#233a4f',
  '--boxmox-color-brand-contrast': '#cfe2f4',
  '--boxmox-color-brand-warning': '#f2a93b',
  '--boxmox-color-text-primary': '#e6edf3',
  '--boxmox-color-text-secondary': '#b9c3cd',
  '--boxmox-color-text-muted': '#8e9aa6',
  '--boxmox-color-text-strong': '#f4f7fa',
  '--boxmox-color-status-success': '#2ecc71',
  '--boxmox-color-status-neutral': '#7f8c8d',
  '--boxmox-color-status-warning': '#f39c12',
  '--boxmox-color-status-danger': '#e74c3c',
  '--boxmox-color-status-info': '#3498db',
  '--boxmox-color-status-paused': '#f1c40f',
  '--boxmox-color-border-default': '#3a424a',
  '--boxmox-color-border-subtle': '#4a545e',
  '--boxmox-color-border-strong': '#23282f',
  '--boxmox-color-header-bg': '#1f2a33',
  '--boxmox-color-header-border': '#182129',
  '--boxmox-color-header-text': '#e6edf3',
  '--boxmox-color-header-text-muted': '#97a6b4',
  '--boxmox-color-header-hover': '#2a3945',
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
