#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const themePalettePath = path.join(
  __dirname,
  '..',
  'apps',
  'frontend',
  'src',
  'theme',
  'themePalette.ts',
);
const source = fs.readFileSync(themePalettePath, 'utf8');

function extractPalette(name) {
  const marker = `export const ${name}: ThemePalette = {`;
  const start = source.indexOf(marker);
  if (start < 0) {
    throw new Error(`Cannot find palette: ${name}`);
  }

  const from = start + marker.length;
  const end = source.indexOf('\n};', from);
  if (end < 0) {
    throw new Error(`Cannot parse palette body: ${name}`);
  }

  const body = source.slice(from, end);
  const entries = {};
  const regex = /'(--boxmox-[^']+)':\s*'(#?[0-9a-fA-F]{6})'/g;
  while (true) {
    const match = regex.exec(body);
    if (match === null) {
      break;
    }
    entries[match[1]] = normalizeHex(match[2]);
  }
  return entries;
}

function normalizeHex(value) {
  const raw = value.trim().toLowerCase();
  if (!raw.startsWith('#')) return `#${raw}`;
  return raw;
}

function hexToRgb(hex) {
  const value = hex.replace('#', '');
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function linearize(channel) {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

function contrastRatio(fg, bg) {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const light = Math.max(l1, l2);
  const dark = Math.min(l1, l2);
  return (light + 0.05) / (dark + 0.05);
}

const checks = [
  { fg: '--boxmox-color-text-primary', bg: '--boxmox-color-surface-base', min: 4.5 },
  { fg: '--boxmox-color-text-primary', bg: '--boxmox-color-surface-panel', min: 4.5 },
  { fg: '--boxmox-color-text-secondary', bg: '--boxmox-color-surface-panel', min: 3.0 },
  { fg: '--boxmox-color-text-muted', bg: '--boxmox-color-surface-panel', min: 3.0 },
  { fg: '--boxmox-color-brand-contrast', bg: '--boxmox-color-brand-soft', min: 4.5 },
  { fg: '--boxmox-color-header-text', bg: '--boxmox-color-header-bg', min: 4.5 },
  { fg: '--boxmox-color-header-text-muted', bg: '--boxmox-color-header-bg', min: 3.0 },
];

const light = extractPalette('DEFAULT_LIGHT_THEME_PALETTE');
const dark = extractPalette('DEFAULT_DARK_THEME_PALETTE');

function runChecks(mode, palette) {
  const results = checks.map((check) => {
    const fg = palette[check.fg];
    const bg = palette[check.bg];
    if (!fg || !bg) {
      return { ...check, fg, bg, ratio: null, pass: false, error: 'missing token value' };
    }
    const ratio = contrastRatio(fg, bg);
    return {
      ...check,
      fg,
      bg,
      ratio: Number(ratio.toFixed(2)),
      pass: ratio >= check.min,
    };
  });
  const failed = results.filter((r) => !r.pass);
  return { mode, failedCount: failed.length, results };
}

const lightReport = runChecks('light', light);
const darkReport = runChecks('dark', dark);
const failedTotal = lightReport.failedCount + darkReport.failedCount;

const report = {
  generatedAtUtc: new Date().toISOString(),
  failedTotal,
  light: lightReport,
  dark: darkReport,
};

const artifactsDir = path.join(__dirname, '..', 'docs', 'audits', 'artifacts', 'theme-contrast');
fs.mkdirSync(artifactsDir, { recursive: true });
const reportPath = path.join(artifactsDir, 'theme-contrast-report-2026-02-18.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

if (failedTotal > 0) {
  console.error(`Theme contrast checks failed (${failedTotal} violations). See ${reportPath}`);
  process.exit(1);
}

console.log(`Theme contrast checks passed. Report: ${reportPath}`);
