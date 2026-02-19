#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = process.cwd();
const outputDir = path.join(repoRoot, 'docs', '_generated');
const outputFile = path.join(outputDir, 'llm-ingest-exclude.txt');

const staticRules = [
  '# LLM ingest exclude profile (Bot-Mox)',
  '# Keep active source-of-truth code/docs; drop heavy/generated/history artifacts.',
  'docs/history/**',
  'docs/_generated/**',
  '**/node_modules/**',
  '**/.turbo/**',
  '**/dist/**',
  '**/build/**',
  '**/coverage/**',
  '**/playwright-report/**',
  '**/test-results/**',
  '**/package-lock.json',
  'pnpm-lock.yaml',
  '**/*.png',
  '**/*.jpg',
  '**/*.jpeg',
  '**/*.webp',
  '**/*.gif',
  '**/*.mp4',
  '**/*.zip',
  '**/*.tar',
  '**/*.gz',
  'apps/frontend/public/runtime-config.js',
  'apps/frontend/src/data/default-unattend-template.xml',
];

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputFile, `${staticRules.join('\n')}\n`, 'utf8');
process.stdout.write(`Wrote ${path.relative(repoRoot, outputFile)}\n`);
