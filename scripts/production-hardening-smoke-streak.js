#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);

function readArg(name) {
  const pref = `${name}=`;
  const found = args.find((arg) => arg.startsWith(pref));
  return found ? found.slice(pref.length) : '';
}

const targetRaw = readArg('--target');
const target = Number.isFinite(Number(targetRaw)) && Number(targetRaw) > 0 ? Number(targetRaw) : 7;

const dateIso = new Date().toISOString().slice(0, 10);
const monthKey = dateIso.slice(0, 7);
const fileArg = readArg('--file');
const relPath =
  fileArg || path.join('docs', 'audits', `production-hardening-smoke-window-${monthKey}.md`);
const absPath = path.join(process.cwd(), relPath);

if (!fs.existsSync(absPath)) {
  process.stderr.write(`Smoke-window report not found: ${relPath}\n`);
  process.exit(1);
}

const source = fs.readFileSync(absPath, 'utf8');
const lines = source.split(/\r?\n/);
const entryLines = lines.filter((line) => /^\|\s*20\d\d-\d\d-\d\dT/.test(line.trim()));

const statuses = entryLines.map((line) => {
  const columns = line
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean);
  return columns[4] || '';
});

let streak = 0;
for (let i = statuses.length - 1; i >= 0; i -= 1) {
  if (statuses[i] !== 'pass') break;
  streak += 1;
}

const remaining = Math.max(target - streak, 0);
process.stdout.write(`Smoke strict-pass streak: ${streak}/${target}\n`);
process.stdout.write(`Remaining to target: ${remaining}\n`);
process.stdout.write(`Source: ${relPath}\n`);
