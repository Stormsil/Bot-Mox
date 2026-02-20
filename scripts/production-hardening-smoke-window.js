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

const authMode = String(process.env.AUTH_MODE || '').trim() || '(unset)';
const agentTransport = String(process.env.AGENT_TRANSPORT || '').trim() || '(unset)';
const vaultMode = String(process.env.SECRETS_VAULT_MODE || '').trim() || '(unset)';

function runCommand(command, commandArgs) {
  const commandLine = `${command} ${commandArgs.join(' ')}`;
  const result = spawnSync(commandLine, {
    cwd: repoRoot,
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
  commandResults.push(runCommand('pnpm', ['run', 'docs:check']));
  commandResults.push(runCommand('pnpm', ['run', 'backend:test']));
  commandResults.push(runCommand('pnpm', ['run', 'agent:test']));
  commandResults.push(runCommand('pnpm', ['run', 'check:infra:gateway']));
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
