#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = process.cwd();
const frontendSrc = path.join(repoRoot, 'apps', 'frontend', 'src');
const backendSrc = path.join(repoRoot, 'apps', 'backend', 'src');
const docsRoot = path.join(repoRoot, 'docs');

const fileExt = new Set(['.ts', '.tsx', '.js', '.jsx']);
const reportDate = new Date().toISOString().slice(0, 10);
const reportPath = path.join(
  repoRoot,
  'docs',
  'audits',
  `engineering-hygiene-baseline-${reportDate}.md`,
);

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function walk(dir, filter, out = []) {
  if (!fs.existsSync(dir)) {
    return out;
  }
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.turbo') {
        continue;
      }
      walk(abs, filter, out);
      continue;
    }

    if (entry.isFile() && filter(abs)) {
      out.push(abs);
    }
  }
  return out;
}

function lineCount(abs) {
  return fs.readFileSync(abs, 'utf8').split('\n').length;
}

function countFiles(dir, extensions) {
  return walk(dir, (abs) => extensions.has(path.extname(abs).toLowerCase())).length;
}

function topByLines(dir, limit = 15) {
  const files = walk(dir, (abs) => fileExt.has(path.extname(abs).toLowerCase()));
  return files
    .map((abs) => ({ path: toPosix(path.relative(repoRoot, abs)), lines: lineCount(abs) }))
    .sort((a, b) => b.lines - a.lines)
    .slice(0, limit);
}

function fsdDistribution() {
  const layers = ['app', 'pages', 'widgets', 'features', 'entities', 'shared'];
  const result = {};
  for (const layer of layers) {
    result[layer] = countFiles(path.join(frontendSrc, layer), fileExt);
  }
  result.components = countFiles(path.join(frontendSrc, 'components'), fileExt);
  result.services = countFiles(path.join(frontendSrc, 'services'), fileExt);
  result.hooks = countFiles(path.join(frontendSrc, 'hooks'), fileExt);
  result.utils = countFiles(path.join(frontendSrc, 'utils'), fileExt);
  result.providers = countFiles(path.join(frontendSrc, 'providers'), fileExt);
  return result;
}

function countRawColorLiteralsInCssModules() {
  const cssFiles = walk(frontendSrc, (abs) => abs.endsWith('.module.css'));
  const pattern = /#(?:[0-9a-fA-F]{3,8})\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g;

  const perFile = [];
  let total = 0;
  for (const abs of cssFiles) {
    const source = fs.readFileSync(abs, 'utf8');
    pattern.lastIndex = 0;
    let count = 0;
    let m = pattern.exec(source);
    while (m) {
      if (!m[0].includes('var(')) {
        count += 1;
      }
      m = pattern.exec(source);
    }
    if (count > 0) {
      total += count;
      perFile.push({ path: toPosix(path.relative(repoRoot, abs)), count });
    }
  }

  perFile.sort((a, b) => b.count - a.count);
  return { total, files: perFile, cssModuleFiles: cssFiles.length };
}

function activeMarkdownCount() {
  const files = walk(docsRoot, (abs) => abs.endsWith('.md')).filter((abs) => {
    const rel = toPosix(path.relative(repoRoot, abs));
    return !rel.startsWith('docs/history/');
  });
  return files.length;
}

const frontendTop = topByLines(frontendSrc);
const backendTop = topByLines(backendSrc);
const distribution = fsdDistribution();
const rawColors = countRawColorLiteralsInCssModules();
const docsCount = activeMarkdownCount();

const lines = [];
lines.push('# Engineering Hygiene Baseline');
lines.push('');
lines.push('Status: Active');
lines.push('Owner: Platform Architecture');
lines.push(`Last Updated: ${reportDate}`);
lines.push('Applies To: Full monorepo');
lines.push('');
lines.push('## Snapshot');
lines.push('');
lines.push(`1. Active markdown docs (non-history): ${docsCount}`);
lines.push(`2. CSS Modules scanned: ${rawColors.cssModuleFiles}`);
lines.push(`3. Raw color literal occurrences in CSS Modules: ${rawColors.total}`);
lines.push('');
lines.push('## FSD Distribution (frontend)');
lines.push('');
for (const [key, value] of Object.entries(distribution)) {
  lines.push(`- ${key}: ${value}`);
}
lines.push('');
lines.push('## Frontend Top Files By Size');
lines.push('');
lines.push('| File | Lines |');
lines.push('|---|---:|');
for (const item of frontendTop) {
  lines.push(`| \`${item.path}\` | ${item.lines} |`);
}
lines.push('');
lines.push('## Backend Top Files By Size');
lines.push('');
lines.push('| File | Lines |');
lines.push('|---|---:|');
for (const item of backendTop) {
  lines.push(`| \`${item.path}\` | ${item.lines} |`);
}
lines.push('');
lines.push('## CSS Raw Literal Hotspots');
lines.push('');
lines.push('| File | Raw Color Literals |');
lines.push('|---|---:|');
for (const item of rawColors.files.slice(0, 15)) {
  lines.push(`| \`${item.path}\` | ${item.count} |`);
}
lines.push('');
lines.push('## Notes');
lines.push('');
lines.push('1. This is a baseline snapshot for enforcing non-regression gates.');
lines.push('2. Use grooming waves to reduce hotspot sizes and raw color literals.');

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${lines.join('\n')}\n`, 'utf8');
process.stdout.write(
  `Engineering hygiene baseline generated: ${toPosix(path.relative(repoRoot, reportPath))}\n`,
);
