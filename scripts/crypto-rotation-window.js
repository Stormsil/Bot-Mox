#!/usr/bin/env node
const { spawnSync } = require('node:child_process');

const args = new Set(process.argv.slice(2));
const strict = args.has('--strict');
const dryRun = args.has('--dry-run');
const repoRoot = process.cwd();

function runNodeScript(scriptRelativePath, extraArgs = []) {
  const result = spawnSync(process.execPath, [scriptRelativePath, ...extraArgs], {
    cwd: repoRoot,
    env: process.env,
    stdio: 'inherit',
  });
  if (result.error) {
    throw result.error;
  }
  return Number.isInteger(result.status) ? result.status : 1;
}

function main() {
  const commonArgs = [];
  if (strict) {
    commonArgs.push('--strict');
  }
  if (dryRun) {
    commonArgs.push('--dry-run');
  }

  process.stdout.write('[crypto-rotation-window] starting\n');
  process.stdout.write(`[crypto-rotation-window] strict=${strict ? 'true' : 'false'}\n`);
  process.stdout.write(`[crypto-rotation-window] dry_run=${dryRun ? 'true' : 'false'}\n`);

  const cycleExit = runNodeScript('scripts/crypto-rotation-safe-cycle.js', commonArgs);
  if (cycleExit !== 0) {
    process.exit(cycleExit);
  }

  const auditArgs = [];
  if (strict) {
    auditArgs.push('--strict');
  }
  const auditExit = runNodeScript('scripts/crypto-rotation-audit-window.js', auditArgs);
  if (auditExit !== 0) {
    process.exit(auditExit);
  }

  process.stdout.write('[crypto-rotation-window] PASS\n');
}

try {
  main();
} catch (error) {
  process.stderr.write(
    `[crypto-rotation-window] FAIL ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
}
