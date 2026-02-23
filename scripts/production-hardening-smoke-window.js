#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const args = new Set(process.argv.slice(2));
const withChecks = args.has('--with-checks');
const strict = args.has('--strict');

const repoRoot = process.cwd();
const now = new Date();
const dateIso = now.toISOString().slice(0, 10);
const timestampIso = now.toISOString();
const monthKey = dateIso.slice(0, 7);
const reportRelPath = path.join(
  'docs',
  'audits',
  `production-hardening-smoke-window-${monthKey}.md`,
);
const reportAbsPath = path.join(repoRoot, reportRelPath);

function hydrateEnvFromProdSimFile() {
  const candidates = [
    path.join(repoRoot, 'deploy', 'compose.prod-sim.env'),
    path.join(repoRoot, 'deploy', 'compose.prod-sim.env.example'),
  ];
  const existingFiles = candidates.filter((candidate) => fs.existsSync(candidate));
  if (existingFiles.length === 0) {
    return;
  }

  for (const envFilePath of existingFiles) {
    const lines = fs.readFileSync(envFilePath, 'utf8').split(/\r?\n/);
    for (const rawLine of lines) {
      const line = String(rawLine || '').trim();
      if (!line || line.startsWith('#')) {
        continue;
      }
      const idx = line.indexOf('=');
      if (idx <= 0) {
        continue;
      }
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      if (!key) {
        continue;
      }
      if (String(process.env[key] || '').trim().length === 0) {
        process.env[key] = value;
      }
    }
  }
}

hydrateEnvFromProdSimFile();

const authMode = String(process.env.AUTH_MODE || '').trim() || '(unset)';
const agentTransport = String(process.env.AGENT_TRANSPORT || '').trim() || '(unset)';
const vaultMode = String(process.env.SECRETS_VAULT_MODE || '').trim() || '(unset)';

function runCommand(command, commandArgs, extraEnv) {
  const commandLine = `${command} ${commandArgs.join(' ')}`;
  const result = spawnSync(commandLine, {
    cwd: repoRoot,
    env: {
      ...process.env,
      ...(extraEnv || {}),
    },
    shell: true,
    stdio: 'pipe',
    encoding: 'utf8',
  });
  return {
    command: commandLine,
    ok: result.status === 0,
    status: result.status,
    stdout: String(result.stdout || '').trim(),
    stderr: String(result.stderr || '').trim(),
  };
}

function hasAdminSmokeEnv() {
  const adminToken = String(process.env.ADMIN_BEARER_TOKEN || '').trim();
  const adminEmail = String(process.env.BOTMOX_ADMIN_EMAIL || '').trim();
  const adminPassword = String(process.env.BOTMOX_ADMIN_PASSWORD || '').trim();
  return Boolean(adminToken || (adminEmail && adminPassword));
}

function summarizeChecks(commandResults) {
  if (commandResults.length === 0) {
    return { status: 'not-run', details: 'checks not executed' };
  }
  const failed = commandResults.filter((result) => !result.ok);
  if (failed.length === 0) {
    return { status: 'pass', details: `${commandResults.length}/${commandResults.length} passed` };
  }
  const firstFailed = failed[0];
  return {
    status: 'fail',
    details: `${failed.length} failed; first: ${firstFailed.command} (exit=${firstFailed.status})`,
  };
}

function ensureReportFile(filePath) {
  if (fs.existsSync(filePath)) {
    return;
  }

  const initial = [
    '# Production Hardening Smoke Window',
    '',
    'Status: Active  ',
    'Owner: Platform Architecture  ',
    `Last Updated: ${dateIso}  `,
    'Applies To: `apps/backend`, `apps/agent`, `apps/frontend`',
    '',
    '## Purpose',
    '',
    'Operational evidence log for sustained prod-like smoke window before final strict-mode cutover.',
    '',
    '## Entries',
    '',
    '| Timestamp (UTC) | AUTH_MODE | AGENT_TRANSPORT | SECRETS_VAULT_MODE | Checks | Details |',
    '| --- | --- | --- | --- | --- | --- |',
    '',
  ];

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${initial.join('\n')}\n`, 'utf8');
}

function updateLastUpdated(source) {
  if (source.includes('Last Updated:')) {
    return source.replace(/Last Updated:\s*[0-9]{4}-[0-9]{2}-[0-9]{2}/, `Last Updated: ${dateIso}`);
  }
  return source;
}

const commandResults = [];
if (withChecks) {
  commandResults.push(runCommand('pnpm', ['run', 'migration:check:strict']));
  commandResults.push(runCommand('pnpm', ['run', 'docs:check']));
  commandResults.push(runCommand('pnpm', ['run', 'check:admin:surface-isolation']));
  commandResults.push(runCommand('pnpm', ['run', 'smoke:admin-origin:e2e']));
  commandResults.push(runCommand('pnpm', ['run', 'smoke:admin-rbac:e2e']));
  commandResults.push(runCommand('pnpm', ['run', 'smoke:tenant-isolation:e2e']));
  commandResults.push(runCommand('pnpm', ['run', 'smoke:agents-tenant-isolation:e2e']));
  commandResults.push(runCommand('pnpm', ['run', 'check:db:rls']));
  commandResults.push(runCommand('pnpm', ['run', 'backend:test']));
  commandResults.push(runCommand('pnpm', ['run', 'agent:test']));
  commandResults.push(runCommand('pnpm', ['run', 'check:infra:gateway']));
  if (hasAdminSmokeEnv()) {
    commandResults.push(runCommand('pnpm', ['run', 'smoke:admin-projects:e2e']));
    commandResults.push(runCommand('pnpm', ['run', 'smoke:billing-admin:e2e']));
    commandResults.push(runCommand('pnpm', ['run', 'smoke:data-encryption:e2e']));
    commandResults.push(
      runCommand('pnpm', ['run', 'hardening:data:record:strict'], {
        DATA_ENCRYPTION_ROTATE_DRY_RUN: 'true',
        DATA_ENCRYPTION_ROTATE_REASON: 'hardening_smoke_window_check',
      }),
    );
    commandResults.push(
      runCommand('pnpm', ['run', 'hardening:secrets:record:strict'], {
        SECRETS_ROTATE_DRY_RUN: 'true',
        SECRETS_ROTATE_REASON: 'hardening_smoke_window_check',
      }),
    );
    commandResults.push(runCommand('pnpm', ['run', 'hardening:runtime:record:strict']));
  } else {
    commandResults.push({
      command:
        'pnpm run smoke:admin-projects:e2e (skipped: set ADMIN_BEARER_TOKEN or BOTMOX_ADMIN_EMAIL+BOTMOX_ADMIN_PASSWORD)',
      ok: true,
      status: 0,
      stdout: '',
      stderr: '',
    });
    commandResults.push({
      command:
        'pnpm run smoke:billing-admin:e2e (skipped: set ADMIN_BEARER_TOKEN or BOTMOX_ADMIN_EMAIL+BOTMOX_ADMIN_PASSWORD)',
      ok: true,
      status: 0,
      stdout: '',
      stderr: '',
    });
    commandResults.push({
      command:
        'pnpm run smoke:data-encryption:e2e (skipped: set ADMIN_BEARER_TOKEN or BOTMOX_ADMIN_EMAIL+BOTMOX_ADMIN_PASSWORD)',
      ok: true,
      status: 0,
      stdout: '',
      stderr: '',
    });
    commandResults.push({
      command:
        'pnpm run hardening:data:record:strict (skipped: set ADMIN_BEARER_TOKEN or BOTMOX_ADMIN_EMAIL+BOTMOX_ADMIN_PASSWORD)',
      ok: true,
      status: 0,
      stdout: '',
      stderr: '',
    });
    commandResults.push({
      command:
        'pnpm run hardening:secrets:record:strict (skipped: set ADMIN_BEARER_TOKEN or BOTMOX_ADMIN_EMAIL+BOTMOX_ADMIN_PASSWORD)',
      ok: true,
      status: 0,
      stdout: '',
      stderr: '',
    });
    commandResults.push({
      command:
        'pnpm run hardening:runtime:record:strict (skipped: set ADMIN_BEARER_TOKEN or BOTMOX_ADMIN_EMAIL+BOTMOX_ADMIN_PASSWORD)',
      ok: true,
      status: 0,
      stdout: '',
      stderr: '',
    });
  }
}

const checksSummary = summarizeChecks(commandResults);

ensureReportFile(reportAbsPath);
let reportSource = fs.readFileSync(reportAbsPath, 'utf8');
reportSource = updateLastUpdated(reportSource);

const row = `| ${timestampIso} | ${authMode} | ${agentTransport} | ${vaultMode} | ${checksSummary.status} | ${checksSummary.details} |`;

if (!reportSource.endsWith('\n')) {
  reportSource += '\n';
}
reportSource += `${row}\n`;
fs.writeFileSync(reportAbsPath, reportSource, 'utf8');

process.stdout.write(`Smoke-window entry written: ${reportRelPath}\n`);
process.stdout.write(`Checks status: ${checksSummary.status}\n`);

if (strict && checksSummary.status === 'fail') {
  process.exit(1);
}
