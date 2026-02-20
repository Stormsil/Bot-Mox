#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const distAssetsDir = path.resolve(__dirname, '..', 'apps', 'frontend', 'dist', 'assets');

const maxRawBytes = Number.parseInt(process.env.BUNDLE_MAX_RAW_BYTES || '2000000', 10);
const maxGzipBytes = Number.parseInt(process.env.BUNDLE_MAX_GZIP_BYTES || '650000', 10);
const vendorReactMaxRawBytes = Number.parseInt(
  process.env.BUNDLE_VENDOR_REACT_MAX_RAW_BYTES || '3900000',
  10,
);
const vendorReactMaxGzipBytes = Number.parseInt(
  process.env.BUNDLE_VENDOR_REACT_MAX_GZIP_BYTES || '1250000',
  10,
);

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function fail(message) {
  console.error(`[bundle-budget] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(distAssetsDir)) {
  fail(`Missing build output at ${distAssetsDir}. Run "pnpm run build" first.`);
}

const files = fs
  .readdirSync(distAssetsDir)
  .filter((file) => file.endsWith('.js'))
  .sort();

if (files.length === 0) {
  fail('No JS assets found in dist output.');
}

const results = files.map((file) => {
  const fullPath = path.join(distAssetsDir, file);
  const source = fs.readFileSync(fullPath);
  const rawBytes = source.length;
  const gzipBytes = zlib.gzipSync(source, { level: 9 }).length;

  return {
    file,
    rawBytes,
    gzipBytes,
  };
});

function getLimitsForFile(file) {
  if (file.startsWith('vendor-react-') && file.endsWith('.js')) {
    return {
      raw: vendorReactMaxRawBytes,
      gzip: vendorReactMaxGzipBytes,
      label: 'vendor-react',
    };
  }
  return {
    raw: maxRawBytes,
    gzip: maxGzipBytes,
    label: 'default',
  };
}

const offenders = results
  .map((entry) => {
    const limits = getLimitsForFile(entry.file);
    return { ...entry, limits };
  })
  .filter((entry) => entry.rawBytes > entry.limits.raw || entry.gzipBytes > entry.limits.gzip);

const sortedByRaw = [...results].sort((a, b) => b.rawBytes - a.rawBytes);
const top = sortedByRaw[0];

console.log(
  `[bundle-budget] Largest JS asset: ${top.file} (raw ${formatBytes(top.rawBytes)}, gzip ${formatBytes(top.gzipBytes)})`,
);
console.log(
  `[bundle-budget] Limits: raw <= ${formatBytes(maxRawBytes)}, gzip <= ${formatBytes(maxGzipBytes)}`,
);
console.log(
  `[bundle-budget] vendor-react limits: raw <= ${formatBytes(vendorReactMaxRawBytes)}, gzip <= ${formatBytes(vendorReactMaxGzipBytes)}`,
);

if (offenders.length > 0) {
  console.error('[bundle-budget] Budget exceeded for:');
  for (const entry of offenders) {
    console.error(
      `  - ${entry.file} [${entry.limits.label}]: raw ${formatBytes(entry.rawBytes)}, gzip ${formatBytes(entry.gzipBytes)} (limits: ${formatBytes(entry.limits.raw)} / ${formatBytes(entry.limits.gzip)})`,
    );
  }
  process.exit(1);
}

console.log('[bundle-budget] OK');
