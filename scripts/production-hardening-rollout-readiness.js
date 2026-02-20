#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = process.cwd();
const args = new Set(process.argv.slice(2));
const withChecks = args.has('--with-checks');

const requiredVaultEnv = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_VAULT_RPC_NAME'];
const authMode = String(process.env.AUTH_MODE || '').trim() || '(unset)';
const agentTransport = String(process.env.AGENT_TRANSPORT || '').trim() || '(unset)';
const vaultMode = String(process.env.SECRETS_VAULT_MODE || '').trim() || '(unset)';

function runCommand(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    cwd: repoRoot,
    stdio: 'pipe',
    encoding: 'utf8',
  });
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: String(result.stdout || '').trim(),
    stderr: String(result.stderr || '').trim(),
    command: `${command} ${commandArgs.join(' ')}`,
  };
}

function buildStatusLine(label, ok, details) {
  return `- ${ok ? 'PASS' : 'FAIL'}: ${label}${details ? ` (${details})` : ''}`;
}

function isoDate() {
  return new Date().toISOString().slice(0, 10);
}

const checks = [];
checks.push({
  label: 'AUTH_MODE is set',
  ok: authMode !== '(unset)',
  details: `AUTH_MODE=${authMode}`,
});
checks.push({
  label: 'AGENT_TRANSPORT is set',
  ok: agentTransport !== '(unset)',
  details: `AGENT_TRANSPORT=${agentTransport}`,
});
checks.push({
  label: 'SECRETS_VAULT_MODE is set',
  ok: vaultMode !== '(unset)',
  details: `SECRETS_VAULT_MODE=${vaultMode}`,
});

if (vaultMode.toLowerCase() === 'enforced') {
  for (const key of requiredVaultEnv) {
    const value = String(process.env[key] || '').trim();
    checks.push({
      label: `${key} present for enforced vault mode`,
      ok: value.length > 0,
      details: value ? 'set' : 'missing',
    });
  }
}

const commandChecks = [];
if (withChecks) {
  commandChecks.push(runCommand('pnpm', ['run', 'docs:check']));
  commandChecks.push(runCommand('pnpm', ['run', 'backend:test']));
  commandChecks.push(runCommand('pnpm', ['run', 'agent:test']));
}

const allStaticOk = checks.every((check) => check.ok);
const allCommandOk = commandChecks.every((check) => check.ok);
const overallOk = allStaticOk && allCommandOk;

const reportDate = isoDate();
const reportRelPath = path.join(
  'docs',
  'audits',
  `production-hardening-rollout-readiness-${reportDate}.md`,
);
const reportAbsPath = path.join(repoRoot, reportRelPath);

const lines = [];
lines.push('# Production Hardening Rollout Readiness');
lines.push('');
lines.push('Status: Active  ');
lines.push('Owner: Platform Architecture  ');
lines.push(`Last Updated: ${reportDate}  `);
lines.push('Applies To: `apps/backend`, `apps/agent`, `apps/frontend`');
lines.push('');
lines.push('## Summary');
lines.push('');
lines.push(
  overallOk
    ? '- Overall status: `PASS` (baseline readiness checks are green).'
    : '- Overall status: `FAIL` (at least one readiness check failed).',
);
lines.push('');
lines.push('## Environment Checks');
lines.push('');
for (const check of checks) {
  lines.push(buildStatusLine(check.label, check.ok, check.details));
}

if (withChecks) {
  lines.push('');
  lines.push('## Command Checks');
  lines.push('');
  for (const check of commandChecks) {
    lines.push(buildStatusLine(check.command, check.ok, `exit=${check.status}`));
  }
}

lines.push('');
lines.push('## Notes');
lines.push('');
lines.push(
  '- This report is a rollout-readiness snapshot and must be paired with the runbook: `docs/runbooks/production-hardening-rollout-checklist.md`.',
);
lines.push(
  '- If running with `--with-checks`, command outputs should be reviewed in CI logs or local terminal output.',
);
lines.push('');

fs.mkdirSync(path.dirname(reportAbsPath), { recursive: true });
fs.writeFileSync(reportAbsPath, `${lines.join('\n')}\n`, 'utf8');

process.stdout.write(`Rollout readiness report written: ${reportRelPath}\n`);
process.stdout.write(
  `${overallOk ? 'PASS' : 'FAIL'}: static checks=${allStaticOk ? 'green' : 'red'}, command checks=${allCommandOk ? 'green' : 'red'}\n`,
);

if (!overallOk) {
  process.exit(1);
}
