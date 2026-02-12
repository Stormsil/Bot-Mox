#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const distAssetsDir = path.resolve(__dirname, '..', 'bot-mox', 'dist', 'assets');

const maxRawBytes = Number.parseInt(process.env.BUNDLE_MAX_RAW_BYTES || '2000000', 10);
const maxGzipBytes = Number.parseInt(process.env.BUNDLE_MAX_GZIP_BYTES || '650000', 10);

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
  fail(`Missing build output at ${distAssetsDir}. Run "npm run build" first.`);
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

const offenders = results.filter(
  (entry) => entry.rawBytes > maxRawBytes || entry.gzipBytes > maxGzipBytes
);

const sortedByRaw = [...results].sort((a, b) => b.rawBytes - a.rawBytes);
const top = sortedByRaw[0];

console.log(
  `[bundle-budget] Largest JS asset: ${top.file} (raw ${formatBytes(top.rawBytes)}, gzip ${formatBytes(top.gzipBytes)})`
);
console.log(
  `[bundle-budget] Limits: raw <= ${formatBytes(maxRawBytes)}, gzip <= ${formatBytes(maxGzipBytes)}`
);

if (offenders.length > 0) {
  console.error('[bundle-budget] Budget exceeded for:');
  for (const entry of offenders) {
    console.error(
      `  - ${entry.file}: raw ${formatBytes(entry.rawBytes)}, gzip ${formatBytes(entry.gzipBytes)}`
    );
  }
  process.exit(1);
}

console.log('[bundle-budget] OK');
