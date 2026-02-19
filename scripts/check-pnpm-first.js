#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = process.cwd();
const rootPackageJsonPath = path.join(repoRoot, 'package.json');
if (!fs.existsSync(rootPackageJsonPath)) {
  process.stderr.write('Missing package.json in repository root.\n');
  process.exit(1);
}

const SKIP_DIRS = new Set([
  '.git',
  '.turbo',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'playwright-report',
  'test-results',
]);

const allowedScriptsByManifest = new Map();

const automationSources = [
  'start-dev.js',
  'CONTRIBUTING.md',
  'docker-compose.local.yml',
  'deploy/compose.dev.override.yml',
  'deploy/compose.prod-sim.env.example',
  'scripts/bootstrap-supabase-env.ps1',
  'scripts/check-antd6-compatibility.js',
  'bot-mox/Dockerfile',
  'proxy-server/Dockerfile',
  'packages/database-schema/scripts/generate-supabase-types.mjs',
  'packages/database-schema/scripts/check-generated-types.mjs',
];

function collectPackageJsonPaths(startDir, collected) {
  const entries = fs.readdirSync(startDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) {
        continue;
      }

      collectPackageJsonPaths(path.join(startDir, entry.name), collected);
      continue;
    }

    if (!entry.isFile() || entry.name !== 'package.json') {
      continue;
    }

    collected.push(path.join(startDir, entry.name));
  }
}

const packageJsonPaths = [];
collectPackageJsonPaths(repoRoot, packageJsonPaths);

const offenders = [];

for (const manifestPath of packageJsonPaths) {
  const manifestRelativePath = path.relative(repoRoot, manifestPath).split(path.sep).join('/');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const scripts = manifest.scripts || {};
  const allowNpmScripts = allowedScriptsByManifest.get(manifestRelativePath) ?? new Set();

  for (const [name, value] of Object.entries(scripts)) {
    const command = String(value || '');
    if (!/\bnpm\b|\bnpx\b/.test(command)) {
      continue;
    }

    if (allowNpmScripts.has(name)) {
      continue;
    }

    offenders.push({
      name,
      command,
      manifestRelativePath,
    });
  }
}

const scriptCommandPattern = /\b(?:npm|npx)\s+(?:run|install|ci|exec|view|supabase)\b/g;
for (const relativePath of automationSources) {
  const absolutePath = path.join(repoRoot, ...relativePath.split('/'));
  if (!fs.existsSync(absolutePath)) {
    continue;
  }

  const source = fs.readFileSync(absolutePath, 'utf8');
  scriptCommandPattern.lastIndex = 0;
  const match = scriptCommandPattern.exec(source);
  if (!match) {
    continue;
  }

  offenders.push({
    name: '[source]',
    command: match[0],
    manifestRelativePath: relativePath,
  });
}

if (offenders.length > 0) {
  process.stderr.write('Found npm/npx usage in scripts outside allowlist:\n');
  for (const offender of offenders) {
    process.stderr.write(
      `- ${offender.manifestRelativePath} -> ${offender.name}: ${offender.command}\n`,
    );
  }
  process.exit(1);
}

process.stdout.write(
  `pnpm-first script policy is satisfied (${packageJsonPaths.length} manifests).\n`,
);
