import type {
  ThemePalette,
  ThemePalettes,
  ThemeShapeSettings,
  ThemeTypographySettings,
  ThemeVisualPosition,
  ThemeVisualSettings,
  ThemeVisualSize,
} from './themePalette.definitions';
import {
  COMPAT_THEME_COLOR_KEYS,
  createDefaultThemePalettes,
  DEFAULT_THEME_SHAPE_SETTINGS,
  DEFAULT_THEME_TYPOGRAPHY_SETTINGS,
  DEFAULT_THEME_VISUAL_SETTINGS,
  THEME_COLOR_DEFINITIONS,
} from './themePalette.definitions';

export type {
  ThemeColorVariable,
  ThemeMode,
  ThemePalette,
  ThemePalettes,
  ThemeShapeSettings,
  ThemeTypographySettings,
  ThemeVisualMode,
  ThemeVisualPosition,
  ThemeVisualSettings,
  ThemeVisualSize,
} from './themePalette.definitions';
export {
  createDefaultThemePalettes,
  DEFAULT_DARK_THEME_PALETTE,
  DEFAULT_LIGHT_THEME_PALETTE,
  DEFAULT_THEME_SHAPE_SETTINGS,
  DEFAULT_THEME_TYPOGRAPHY_SETTINGS,
  DEFAULT_THEME_VISUAL_SETTINGS,
  THEME_COLOR_DEFINITIONS,
} from './themePalette.definitions';

const HEX_COLOR_PATTERN = /^#?[0-9a-f]+$/i;
const RGB_COLOR_PATTERN = /^rgba?\(([^)]+)\)$/i;

const clampToByte = (value: number): number => Math.max(0, Math.min(255, Math.round(value)));

const normalizeFromHex = (value: string): string | null => {
  const cleaned = value.trim();
  if (!HEX_COLOR_PATTERN.test(cleaned)) return null;

  const hex = cleaned.replace('#', '').toLowerCase();

  if (hex.length === 3) {
    const expanded = hex
      .split('')
      .map((char) => `${char}${char}`)
      .join('');
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

const sanitizePalette = (source: unknown, fallback: ThemePalette): ThemePalette => {
  const sourcePalette = (source ?? {}) as Record<string, unknown>;
  const nextPalette = { ...fallback };

  for (const { cssVar } of THEME_COLOR_DEFINITIONS) {
    const value =
      sourcePalette[cssVar] ??
      COMPAT_THEME_COLOR_KEYS[cssVar]
        .map((compatKey) => sourcePalette[compatKey])
        .find((compatValue) => typeof compatValue === 'string');

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
  const backgroundPosition: ThemeVisualPosition =
    payload.backgroundPosition === 'top'
      ? 'top'
      : payload.backgroundPosition === 'custom'
        ? 'custom'
        : 'center';
  const backgroundSize: ThemeVisualSize =
    payload.backgroundSize === 'contain'
      ? 'contain'
      : payload.backgroundSize === 'auto'
        ? 'auto'
        : 'cover';
  const backgroundAssetId =
    typeof payload.backgroundAssetId === 'string' && payload.backgroundAssetId.trim()
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
    overlayColorLight: normalizeHexColor(
      String(payload.overlayColorLight ?? ''),
      fallback.overlayColorLight,
    ),
    overlayColorDark: normalizeHexColor(
      String(payload.overlayColorDark ?? ''),
      fallback.overlayColorDark,
    ),
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
    '#3b7db8',
  ).replace('#', '');

  const r = Number.parseInt(brandPrimary.slice(0, 2), 16);
  const g = Number.parseInt(brandPrimary.slice(2, 4), 16);
  const b = Number.parseInt(brandPrimary.slice(4, 6), 16);

  document.documentElement.style.setProperty(
    '--boxmox-color-brand-primary-rgb',
    `${r}, ${g}, ${b}`,
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
