#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = process.cwd();
const docsDir = path.join(repoRoot, 'docs');

const SKIP_PREFIXES = ['docs/history/'];
const linkRegex = /\[[^\]]+\]\(([^)]+)\)/g;

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    const rel = path.relative(repoRoot, abs).split(path.sep).join('/');

    if (entry.isDirectory()) {
      walk(abs, files);
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.md')) {
      if (!SKIP_PREFIXES.some((prefix) => rel.startsWith(prefix))) {
        files.push({ abs, rel });
      }
    }
  }
  return files;
}

function isExternal(link) {
  return /^https?:\/\//.test(link) || link.startsWith('mailto:') || link.startsWith('#');
}

if (!fs.existsSync(docsDir)) {
  process.stdout.write('No docs directory, skipping docs links check.\n');
  process.exit(0);
}

const files = walk(docsDir);
const broken = [];

for (const file of files) {
  const source = fs.readFileSync(file.abs, 'utf8');
  let match = linkRegex.exec(source);
  while (match) {
    const raw = match[1].trim();
    if (isExternal(raw)) {
      match = linkRegex.exec(source);
      continue;
    }

    const clean = raw.split('#')[0];
    if (!clean) {
      match = linkRegex.exec(source);
      continue;
    }

    const target = clean.startsWith('/')
      ? path.join(repoRoot, clean.slice(1))
      : path.resolve(path.dirname(file.abs), clean);

    if (!fs.existsSync(target)) {
      broken.push(`${file.rel} -> ${raw}`);
    }

    match = linkRegex.exec(source);
  }
}

if (broken.length > 0) {
  process.stderr.write('Broken local doc links found:\n');
  for (const item of broken) {
    process.stderr.write(`- ${item}\n`);
  }
  process.exit(1);
}

process.stdout.write('Docs links check passed.\n');
