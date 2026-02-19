#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = process.cwd();
const docsDir = path.join(repoRoot, 'docs');

const METADATA_FIELDS = ['Status:', 'Owner:', 'Last Updated:'];
const MAX_AGE_DAYS = 45;

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function walk(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    const rel = toPosix(path.relative(repoRoot, abs));

    if (entry.isDirectory()) {
      if (rel.startsWith('docs/history/')) {
        continue;
      }
      walk(abs, files);
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push({ abs, rel });
    }
  }
  return files;
}

function parseLastUpdated(source) {
  const match = source.match(/Last Updated:\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/);
  return match ? match[1] : null;
}

if (!fs.existsSync(docsDir)) {
  process.stdout.write('No docs directory, skipping docs freshness check.\n');
  process.exit(0);
}

const now = new Date();
const files = walk(docsDir);
const errors = [];

for (const file of files) {
  const source = fs.readFileSync(file.abs, 'utf8');

  for (const field of METADATA_FIELDS) {
    if (!source.includes(field)) {
      errors.push(`${file.rel}: missing metadata field ${field}`);
    }
  }

  const dateRaw = parseLastUpdated(source);
  if (!dateRaw) {
    continue;
  }

  const date = new Date(`${dateRaw}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    errors.push(`${file.rel}: invalid Last Updated date (${dateRaw})`);
    continue;
  }

  const ageDays = Math.floor((now.getTime() - date.getTime()) / (24 * 60 * 60 * 1000));
  if (ageDays > MAX_AGE_DAYS) {
    errors.push(
      `${file.rel}: stale documentation (${ageDays} days old, max ${MAX_AGE_DAYS}, date ${dateRaw})`,
    );
  }
}

if (errors.length > 0) {
  process.stderr.write('Docs freshness check failed:\n');
  for (const error of errors) {
    process.stderr.write(`- ${error}\n`);
  }
  process.exit(1);
}

process.stdout.write(`Docs freshness check passed (${files.length} active markdown files).\n`);
