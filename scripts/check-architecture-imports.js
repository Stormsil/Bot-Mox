#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = process.cwd();
const configPath = path.join(repoRoot, 'configs', 'architecture-checks.config.json');

const STAGE_WARN = 'warn';
const STAGE_SOFT_FAIL = 'soft-fail';
const STAGE_HARD_FAIL = 'hard-fail';
const ALLOWED_STAGES = new Set([STAGE_WARN, STAGE_SOFT_FAIL, STAGE_HARD_FAIL]);

const scripts = [
  'scripts/check-ui-boundaries.js',
  'scripts/check-entities-service-boundary.js',
  'scripts/check-vm-provider-boundary.js',
  'scripts/check-backend-domain-boundaries.js',
];

function normalizeStage(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  return ALLOWED_STAGES.has(normalized) ? normalized : null;
}

function readConfigDefaultStage() {
  if (!fs.existsSync(configPath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return normalizeStage(parsed?.architecture?.ratchetStage || parsed?.ratchetStage);
  } catch (_error) {
    process.stderr.write(
      `[check-architecture-imports] warning: failed to parse ${path.relative(repoRoot, configPath)}; using fallback stage.\n`,
    );
    return null;
  }
}

function resolveRatchetStage() {
  const envStage = normalizeStage(
    process.env.ARCHITECTURE_RATCHET_STAGE || process.env.ARCH_CHECK_RATCHET_STAGE,
  );
  if (envStage) {
    return { stage: envStage, source: 'env' };
  }

  const configStage = readConfigDefaultStage();
  if (configStage) {
    return { stage: configStage, source: 'config-default' };
  }

  return { stage: STAGE_WARN, source: 'builtin-default' };
}

const { stage, source } = resolveRatchetStage();

process.stdout.write(`[check-architecture-imports] ratchet stage: ${stage} (source: ${source})\n`);

let failedChecks = 0;
for (const script of scripts) {
  const result = spawnSync(process.execPath, [script], {
    stdio: 'pipe',
    encoding: 'utf8',
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  const exitCode = typeof result.status === 'number' ? result.status : 1;
  const isPass = exitCode === 0;
  if (!isPass) {
    failedChecks += 1;
  }

  const perCheckStatus = isPass ? 'PASS' : stage === STAGE_WARN ? 'WARN' : 'FAIL';
  process.stdout.write(
    `[check-architecture-imports] ${perCheckStatus} ${script} (exit=${exitCode})\n`,
  );

  if (result.error) {
    process.stderr.write(
      `[check-architecture-imports] ${script} spawn error: ${String(result.error.message || result.error)}\n`,
    );
    failedChecks += 1;
  }
}

const passedChecks = scripts.length - failedChecks;
process.stdout.write(
  `[check-architecture-imports] summary: passed=${passedChecks}, failed=${failedChecks}, stage=${stage}\n`,
);

if (failedChecks > 0 && stage !== STAGE_WARN) {
  const stageLabel = stage === STAGE_SOFT_FAIL ? 'soft-fail' : 'hard-fail';
  process.stderr.write(
    `[check-architecture-imports] ${stageLabel} stage active; failing due to violations.\n`,
  );
  process.exit(1);
}

process.stdout.write('[check-architecture-imports] completed.\n');
