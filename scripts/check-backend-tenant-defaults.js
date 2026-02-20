#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = process.cwd();
const modulesRoot = path.join(repoRoot, 'apps', 'backend', 'src', 'modules');

const ALLOWED_FILES = new Set();

const SKIP_SUFFIXES = ['.test.ts'];
const CANDIDATE_SUFFIXES = ['.ts'];

const FALLBACK_PATTERNS = [
  { label: 'nullish-default-tenant', regex: /\?\?\s*['"]default['"]/g },
  { label: 'or-default-tenant', regex: /\|\|\s*['"]default['"]/g },
  { label: 'literal-default-tenant', regex: /tenantId\s*:\s*['"]default['"]/g },
];

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function listFilesRecursively(dir) {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFilesRecursively(full));
      continue;
    }
    if (!entry.isFile()) continue;
    if (!CANDIDATE_SUFFIXES.some((s) => entry.name.endsWith(s))) continue;
    if (SKIP_SUFFIXES.some((s) => entry.name.endsWith(s))) continue;
    out.push(full);
  }
  return out;
}

function lineForIndex(source, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (source[i] === '\n') line += 1;
  }
  return line;
}

if (!fs.existsSync(modulesRoot)) {
  process.stdout.write('tenant-defaults check skipped: backend modules path not found.\n');
  process.exit(0);
}

const files = listFilesRecursively(modulesRoot);
const violations = [];

for (const file of files) {
  const rel = toPosix(path.relative(repoRoot, file));
  if (ALLOWED_FILES.has(rel)) {
    continue;
  }
  const source = fs.readFileSync(file, 'utf8');
  for (const { label, regex } of FALLBACK_PATTERNS) {
    regex.lastIndex = 0;
    let match = regex.exec(source);
    while (match) {
      violations.push({
        file: rel,
        line: lineForIndex(source, match.index),
        label,
        snippet: match[0],
      });
      match = regex.exec(source);
    }
  }
}

if (violations.length > 0) {
  process.stderr.write('Forbidden tenant default fallbacks found in backend runtime code:\n');
  for (const v of violations) {
    process.stderr.write(`- ${v.file}:${v.line} [${v.label}] ${v.snippet}\n`);
  }
  process.exit(1);
}

process.stdout.write(`Backend tenant fallback check passed (${files.length} files scanned).\n`);
