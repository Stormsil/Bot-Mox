#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = process.cwd();
const args = new Set(process.argv.slice(2));
const srcRoot = path.join(repoRoot, 'apps', 'frontend', 'src');
const baselinePath = path.join(repoRoot, 'configs', 'style-token-usage-baseline.json');
const businessScopes = [
  path.join(srcRoot, 'pages'),
  path.join(srcRoot, 'widgets'),
  path.join(srcRoot, 'features'),
];

const fileExt = new Set(['.css']);
const colorLiteralPattern = /#(?:[0-9a-fA-F]{3,8})\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g;
const legacyPrefixPattern = /--boxmox-/;

function walk(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.turbo') {
        continue;
      }
      walk(abs, out);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (!entry.name.endsWith('.module.css')) {
      continue;
    }

    if (!fileExt.has(path.extname(entry.name).toLowerCase())) {
      continue;
    }

    out.push(abs);
  }

  return out;
}

function normalizeRel(abs) {
  return path.relative(repoRoot, abs).split(path.sep).join('/');
}

function walkForExtensions(dir, extensions, out = []) {
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
      walkForExtensions(abs, extensions, out);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (extensions.has(ext)) {
      out.push(abs);
    }
  }

  return out;
}

function countRawLiterals(source) {
  let count = 0;
  colorLiteralPattern.lastIndex = 0;
  let m = colorLiteralPattern.exec(source);
  while (m) {
    const token = m[0];
    if (!token.includes('var(')) {
      count += 1;
    }
    m = colorLiteralPattern.exec(source);
  }
  return count;
}

function readBaseline() {
  if (!fs.existsSync(baselinePath)) {
    return { files: {} };
  }
  return JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
}

function writeBaseline(filesMap) {
  const payload = {
    generated_at_utc: new Date().toISOString(),
    note: 'Do not hand edit. Update intentionally via `pnpm run check:style:token-usage -- --update-baseline` after approved refactors.',
    files: filesMap,
  };
  fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
  fs.writeFileSync(baselinePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

if (!fs.existsSync(srcRoot)) {
  process.stdout.write('Frontend src not found, skipping style token usage check.\n');
  process.exit(0);
}

const moduleCssFiles = walk(srcRoot);
const current = {};
for (const file of moduleCssFiles) {
  const rel = normalizeRel(file);
  const source = fs.readFileSync(file, 'utf8');
  const count = countRawLiterals(source);
  if (count > 0) {
    current[rel] = count;
  }
}

if (args.has('--update-baseline')) {
  writeBaseline(current);
  process.stdout.write(
    `Style token usage baseline updated (${Object.keys(current).length} files).\n`,
  );
  process.exit(0);
}

if (!args.has('--ratchet-prefix-only')) {
  const baseline = readBaseline();
  const baselineFiles = baseline.files || {};
  const violations = [];

  for (const [rel, count] of Object.entries(current)) {
    const allowed = baselineFiles[rel] ?? 0;
    if (count > allowed) {
      violations.push(`${rel}: ${count} raw color literals > baseline ${allowed}`);
    }
  }

  if (violations.length > 0) {
    process.stderr.write('Style token usage check failed (new/raw color literals introduced).\n');
    for (const violation of violations) {
      process.stderr.write(`- ${violation}\n`);
    }
    process.stderr.write(
      'If this increase is intentional and approved, update baseline via --update-baseline.\n',
    );
    process.exit(1);
  }
}

const legacyPrefixFiles = [];
const ratchetExtensions = new Set(['.ts', '.tsx', '.css']);
for (const scopeDir of businessScopes) {
  const scopedFiles = walkForExtensions(scopeDir, ratchetExtensions);
  for (const file of scopedFiles) {
    const text = fs.readFileSync(file, 'utf8');
    if (!legacyPrefixPattern.test(text)) {
      continue;
    }
    legacyPrefixFiles.push(normalizeRel(file));
  }
}

if (legacyPrefixFiles.length > 0) {
  process.stderr.write(
    'Style token usage check failed (legacy --boxmox- prefix found in business scopes).\n',
  );
  for (const file of legacyPrefixFiles.sort()) {
    process.stderr.write(`- ${file}\n`);
  }
  process.exit(1);
}

process.stdout.write(
  `Style token usage check passed (${Object.keys(current).length} tracked files; legacyPrefix=0 in business scopes).\n`,
);
