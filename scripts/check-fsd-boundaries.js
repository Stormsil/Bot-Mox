#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = process.cwd();
const frontendRoot = path.join(repoRoot, 'apps', 'frontend', 'src');

const layers = ['app', 'pages', 'widgets', 'features', 'entities', 'shared'];
const layerRank = Object.fromEntries(layers.map((layer, index) => [layer, layers.length - index]));
const fileExt = new Set(['.ts', '.tsx', '.js', '.jsx']);

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function listLayerFiles() {
  const files = [];
  for (const layer of layers) {
    const layerDir = path.join(frontendRoot, layer);
    if (!fs.existsSync(layerDir)) {
      continue;
    }
    walk(layerDir, files);
  }
  return files;
}

function walk(dir, files) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') {
        continue;
      }
      walk(abs, files);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (!fileExt.has(path.extname(entry.name).toLowerCase())) {
      continue;
    }

    files.push(abs);
  }
}

function detectLayerFromRel(rel) {
  const parts = rel.split('/');
  const first = parts[0];
  return layers.includes(first) ? first : null;
}

function resolveImportLayer(importPath, fromFileAbs) {
  if (importPath.startsWith('.')) {
    const resolvedAbs = path.resolve(path.dirname(fromFileAbs), importPath);
    const relFromSrc = toPosix(path.relative(frontendRoot, resolvedAbs));
    return detectLayerFromRel(relFromSrc);
  }

  if (importPath.startsWith('@/')) {
    const rel = importPath.slice(2);
    return detectLayerFromRel(rel);
  }

  const normalized = importPath.replace(/^src\//, '');
  return detectLayerFromRel(normalized);
}

function getLineNumber(source, index) {
  return source.slice(0, index).split('\n').length;
}

if (!fs.existsSync(frontendRoot)) {
  process.stdout.write('FSD boundaries: frontend src not found, skipping.\n');
  process.exit(0);
}

const files = listLayerFiles();
const violations = [];

for (const fileAbs of files) {
  const relFromSrc = toPosix(path.relative(frontendRoot, fileAbs));
  const fromLayer = detectLayerFromRel(relFromSrc);
  if (!fromLayer) {
    continue;
  }

  const source = fs.readFileSync(fileAbs, 'utf8');
  const importPattern = /import\s+(?:type\s+)?[\s\S]*?\sfrom\s+['"]([^'"]+)['"]/g;
  const dynamicImportPattern = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

  for (const pattern of [importPattern, dynamicImportPattern]) {
    pattern.lastIndex = 0;
    let m = pattern.exec(source);
    while (m) {
      const importPath = m[1] || '';
      const toLayer = resolveImportLayer(importPath, fileAbs);
      if (toLayer) {
        const fromRank = layerRank[fromLayer];
        const toRank = layerRank[toLayer];
        // high-level layers cannot depend on higher-level peers.
        // allowed: same layer, lower layers.
        if (toRank > fromRank) {
          violations.push({
            file: `apps/frontend/src/${relFromSrc}`,
            line: getLineNumber(source, m.index),
            fromLayer,
            toLayer,
            importPath,
          });
        }
      }

      m = pattern.exec(source);
    }
  }
}

if (violations.length > 0) {
  process.stderr.write('FSD boundary check failed:\n');
  for (const v of violations) {
    process.stderr.write(
      `- ${v.file}:${v.line} ${v.fromLayer} -> ${v.toLayer} via ${v.importPath}\n`,
    );
  }
  process.exit(1);
}

process.stdout.write(`FSD boundary check passed (${files.length} files checked).\n`);
