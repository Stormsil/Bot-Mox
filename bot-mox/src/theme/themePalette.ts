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

const LEGACY_THEME_COLOR_KEYS: Record<ThemeColorVariable, string[]> = {
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

const HEX_COLOR_PATTERN = /^#?[0-9a-f]+$/i;
const RGB_COLOR_PATTERN = /^rgba?\(([^)]+)\)$/i;

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

const clampToByte = (value: number): number => Math.max(0, Math.min(255, Math.round(value)));

const normalizeFromHex = (value: string): string | null => {
  const cleaned = value.trim();
  if (!HEX_COLOR_PATTERN.test(cleaned)) return null;

  const hex = cleaned.replace('#', '').toLowerCase();

  if (hex.length === 3) {
    const expanded = hex.split('').map((char) => `${char}${char}`).join('');
    return `#${expanded}`;
  }

  if (hex.length === 4) {
    const expanded = hex
      .slice(0, 3)
      .split('')
      .map((char) => `${char}${char}`)
      .join('');
    return `#${expanded}`;
  }

  if (hex.length === 6) {
    return `#${hex}`;
  }

  if (hex.length === 8) {
    return `#${hex.slice(0, 6)}`;
  }

  return null;
};

const normalizeFromRgb = (value: string): string | null => {
  const match = value.trim().match(RGB_COLOR_PATTERN);
  if (!match) return null;

  const channels = match[1]
    .split(',')
    .map((part) => part.trim())
    .slice(0, 3)
    .map((part) => Number.parseFloat(part));

  if (channels.length !== 3 || channels.some((channel) => Number.isNaN(channel))) {
    return null;
  }

  const [r, g, b] = channels.map(clampToByte);
  const toHex = (channel: number) => channel.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

export const normalizeHexColor = (value: string, fallback: string): string => {
  const fromHex = normalizeFromHex(value);
  if (fromHex) {
    return fromHex;
  }

  const fromRgb = normalizeFromRgb(value);
  if (fromRgb) {
    return fromRgb;
  }

  const fallbackHex = normalizeFromHex(fallback);
  return fallbackHex ?? '#000000';
};

const sanitizePalette = (
  source: unknown,
  fallback: ThemePalette
): ThemePalette => {
  const sourcePalette = (source ?? {}) as Record<string, unknown>;
  const nextPalette = { ...fallback };

  for (const { cssVar } of THEME_COLOR_DEFINITIONS) {
    const value =
      sourcePalette[cssVar] ??
      LEGACY_THEME_COLOR_KEYS[cssVar]
        .map((legacyKey) => sourcePalette[legacyKey])
        .find((legacyValue) => typeof legacyValue === 'string');

    if (typeof value === 'string') {
      nextPalette[cssVar] = normalizeHexColor(value, fallback[cssVar]);
    }
  }

  return nextPalette;
};

export const sanitizeThemePalettes = (source: unknown): ThemePalettes => {
  const fallback = createDefaultThemePalettes();
  const payload = (source ?? {}) as Record<string, unknown>;

  return {
    light: sanitizePalette(payload.light, fallback.light),
    dark: sanitizePalette(payload.dark, fallback.dark),
  };
};

function sanitizeBackgroundUrl(input: unknown): string | undefined {
  if (typeof input !== 'string') return undefined;
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return undefined;
}

function clampNumber(input: unknown, fallback: number, min: number, max: number): number {
  const value = Number(input);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

export const sanitizeThemeVisualSettings = (source: unknown): ThemeVisualSettings => {
  const payload = (source ?? {}) as Record<string, unknown>;
  const fallback = DEFAULT_THEME_VISUAL_SETTINGS;

  const mode = payload.mode === 'image' ? 'image' : 'none';
  const backgroundPosition: ThemeVisualPosition = payload.backgroundPosition === 'top'
    ? 'top'
    : payload.backgroundPosition === 'custom'
      ? 'custom'
      : 'center';
  const backgroundSize: ThemeVisualSize = payload.backgroundSize === 'contain'
    ? 'contain'
    : payload.backgroundSize === 'auto'
      ? 'auto'
      : 'cover';
  const backgroundAssetId = typeof payload.backgroundAssetId === 'string' && payload.backgroundAssetId.trim()
    ? payload.backgroundAssetId.trim()
    : undefined;

  return {
    enabled: payload.enabled === true,
    mode,
    backgroundAssetId,
    backgroundImageUrl: sanitizeBackgroundUrl(payload.backgroundImageUrl),
    backgroundPosition,
    backgroundSize,
    overlayOpacity: clampNumber(payload.overlayOpacity, fallback.overlayOpacity, 0, 1),
    overlayColorLight: normalizeHexColor(String(payload.overlayColorLight ?? ''), fallback.overlayColorLight),
    overlayColorDark: normalizeHexColor(String(payload.overlayColorDark ?? ''), fallback.overlayColorDark),
    blurPx: clampNumber(payload.blurPx, fallback.blurPx, 0, 24),
    dimStrength: clampNumber(payload.dimStrength, fallback.dimStrength, 0, 1),
  };
};

export const sanitizeThemeTypographySettings = (source: unknown): ThemeTypographySettings => {
  const payload = (source ?? {}) as Record<string, unknown>;
  const fallback = DEFAULT_THEME_TYPOGRAPHY_SETTINGS;

  const normalizeFont = (value: unknown, fallbackValue: string): string => {
    if (typeof value !== 'string') return fallbackValue;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallbackValue;
  };

  return {
    fontPrimary: normalizeFont(payload.fontPrimary, fallback.fontPrimary),
    fontCondensed: normalizeFont(payload.fontCondensed, fallback.fontCondensed),
    fontMono: normalizeFont(payload.fontMono, fallback.fontMono),
  };
};

export const sanitizeThemeShapeSettings = (source: unknown): ThemeShapeSettings => {
  const payload = (source ?? {}) as Record<string, unknown>;
  const fallback = DEFAULT_THEME_SHAPE_SETTINGS;

  const clamp = (value: unknown, fallbackValue: number, min: number, max: number): number => {
    const num = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(num)) return fallbackValue;
    return Math.max(min, Math.min(max, Math.round(num)));
  };

  return {
    radiusNone: clamp(payload.radiusNone, fallback.radiusNone, 0, 24),
    radiusSm: clamp(payload.radiusSm, fallback.radiusSm, 0, 24),
    radiusMd: clamp(payload.radiusMd, fallback.radiusMd, 0, 24),
    radiusLg: clamp(payload.radiusLg, fallback.radiusLg, 0, 24),
  };
};

export const applyThemePaletteToDocument = (palette: ThemePalette): void => {
  if (typeof document === 'undefined') return;

  for (const { cssVar } of THEME_COLOR_DEFINITIONS) {
    document.documentElement.style.setProperty(cssVar, palette[cssVar]);
  }

  const brandPrimary = normalizeHexColor(
    palette['--boxmox-color-brand-primary'],
    '#3b7db8'
  ).replace('#', '');

  const r = Number.parseInt(brandPrimary.slice(0, 2), 16);
  const g = Number.parseInt(brandPrimary.slice(2, 4), 16);
  const b = Number.parseInt(brandPrimary.slice(4, 6), 16);

  document.documentElement.style.setProperty(
    '--boxmox-color-brand-primary-rgb',
    `${r}, ${g}, ${b}`
  );
};

export const applyThemeTypographyToDocument = (typography: ThemeTypographySettings): void => {
  if (typeof document === 'undefined') return;
  const next = sanitizeThemeTypographySettings(typography);
  document.documentElement.style.setProperty('--font-primary', next.fontPrimary);
  document.documentElement.style.setProperty('--font-condensed', next.fontCondensed);
  document.documentElement.style.setProperty('--font-mono', next.fontMono);
};

export const applyThemeShapeToDocument = (shape: ThemeShapeSettings): void => {
  if (typeof document === 'undefined') return;
  const next = sanitizeThemeShapeSettings(shape);
  document.documentElement.style.setProperty('--radius-none', `${next.radiusNone}px`);
  document.documentElement.style.setProperty('--radius-sm', `${next.radiusSm}px`);
  document.documentElement.style.setProperty('--radius-md', `${next.radiusMd}px`);
  document.documentElement.style.setProperty('--radius-lg', `${next.radiusLg}px`);
};
