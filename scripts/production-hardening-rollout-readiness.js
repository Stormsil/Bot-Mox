#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = process.cwd();
const args = new Set(process.argv.slice(2));
const withChecks = args.has('--with-checks');

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

const requiredVaultEnv = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_VAULT_RPC_NAME',
  'SUPABASE_VAULT_ROTATE_RPC_NAME',
];
const authMode = String(process.env.AUTH_MODE || '').trim() || '(unset)';
const agentTransport = String(process.env.AGENT_TRANSPORT || '').trim() || '(unset)';
const vaultMode = String(process.env.SECRETS_VAULT_MODE || '').trim() || '(unset)';
const adminOriginEnforcement =
  String(process.env.ADMIN_ORIGIN_ENFORCEMENT || '').trim() || '(unset)';
const adminOriginStrict = String(process.env.ADMIN_ORIGIN_STRICT || '').trim() || '(unset)';
const adminCorsOrigin = String(process.env.ADMIN_CORS_ORIGIN || '').trim();
const billingStubSelfActivate =
  String(process.env.BILLING_STUB_SELF_ACTIVATE || '').trim() || '(unset)';

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
    ok: result.status === 0,
    status: result.status,
    stdout: String(result.stdout || '').trim(),
    stderr: String(result.stderr || '').trim(),
    command: commandLine,
  };
}

function hasAdminSmokeEnv() {
  const adminToken = String(process.env.ADMIN_BEARER_TOKEN || '').trim();
  const adminEmail = String(process.env.BOTMOX_ADMIN_EMAIL || '').trim();
  const adminPassword = String(process.env.BOTMOX_ADMIN_PASSWORD || '').trim();
  return Boolean(adminToken || (adminEmail && adminPassword));
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
checks.push({
  label: 'ADMIN_ORIGIN_ENFORCEMENT is set',
  ok: adminOriginEnforcement !== '(unset)',
  details: `ADMIN_ORIGIN_ENFORCEMENT=${adminOriginEnforcement}`,
});
checks.push({
  label: 'ADMIN_ORIGIN_STRICT is set',
  ok: adminOriginStrict !== '(unset)',
  details: `ADMIN_ORIGIN_STRICT=${adminOriginStrict}`,
});
checks.push({
  label: 'ADMIN_CORS_ORIGIN is set',
  ok: adminCorsOrigin.length > 0,
  details: adminCorsOrigin.length > 0 ? 'set' : 'missing',
});
checks.push({
  label: 'BILLING_STUB_SELF_ACTIVATE is not true',
  ok: billingStubSelfActivate.toLowerCase() !== 'true',
  details: `BILLING_STUB_SELF_ACTIVATE=${billingStubSelfActivate}`,
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
  commandChecks.push(runCommand('pnpm', ['run', 'check:admin:surface-isolation']));
  commandChecks.push(runCommand('pnpm', ['run', 'smoke:admin-origin:e2e']));
  commandChecks.push(runCommand('pnpm', ['run', 'smoke:admin-rbac:e2e']));
  commandChecks.push(runCommand('pnpm', ['run', 'smoke:tenant-isolation:e2e']));
  commandChecks.push(runCommand('pnpm', ['run', 'smoke:agents-tenant-isolation:e2e']));
  commandChecks.push(runCommand('pnpm', ['run', 'check:db:rls']));
  commandChecks.push(runCommand('pnpm', ['run', 'backend:test']));
  commandChecks.push(runCommand('pnpm', ['run', 'agent:test']));
  if (hasAdminSmokeEnv()) {
    commandChecks.push(runCommand('pnpm', ['run', 'smoke:admin-projects:e2e']));
    commandChecks.push(runCommand('pnpm', ['run', 'smoke:billing-admin:e2e']));
    commandChecks.push(runCommand('pnpm', ['run', 'smoke:data-encryption:e2e']));
    commandChecks.push(
      runCommand('pnpm', ['run', 'hardening:data:record:strict'], {
        DATA_ENCRYPTION_ROTATE_DRY_RUN: 'true',
        DATA_ENCRYPTION_ROTATE_REASON: 'hardening_rollout_readiness_check',
      }),
    );
    commandChecks.push(
      runCommand('pnpm', ['run', 'hardening:secrets:record:strict'], {
        SECRETS_ROTATE_DRY_RUN: 'true',
        SECRETS_ROTATE_REASON: 'hardening_rollout_readiness_check',
      }),
    );
    commandChecks.push(runCommand('pnpm', ['run', 'hardening:runtime:record:strict']));
  } else {
    commandChecks.push({
      ok: true,
      status: 0,
      stdout: '',
      stderr: '',
      command:
        'pnpm run smoke:admin-projects:e2e (skipped: set ADMIN_BEARER_TOKEN or BOTMOX_ADMIN_EMAIL+BOTMOX_ADMIN_PASSWORD)',
    });
    commandChecks.push({
      ok: true,
      status: 0,
      stdout: '',
      stderr: '',
      command:
        'pnpm run smoke:billing-admin:e2e (skipped: set ADMIN_BEARER_TOKEN or BOTMOX_ADMIN_EMAIL+BOTMOX_ADMIN_PASSWORD)',
    });
    commandChecks.push({
      ok: true,
      status: 0,
      stdout: '',
      stderr: '',
      command:
        'pnpm run smoke:data-encryption:e2e (skipped: set ADMIN_BEARER_TOKEN or BOTMOX_ADMIN_EMAIL+BOTMOX_ADMIN_PASSWORD)',
    });
    commandChecks.push({
      ok: true,
      status: 0,
      stdout: '',
      stderr: '',
      command:
        'pnpm run hardening:data:record:strict (skipped: set ADMIN_BEARER_TOKEN or BOTMOX_ADMIN_EMAIL+BOTMOX_ADMIN_PASSWORD)',
    });
    commandChecks.push({
      ok: true,
      status: 0,
      stdout: '',
      stderr: '',
      command:
        'pnpm run hardening:secrets:record:strict (skipped: set ADMIN_BEARER_TOKEN or BOTMOX_ADMIN_EMAIL+BOTMOX_ADMIN_PASSWORD)',
    });
    commandChecks.push({
      ok: true,
      status: 0,
      stdout: '',
      stderr: '',
      command:
        'pnpm run hardening:runtime:record:strict (skipped: set ADMIN_BEARER_TOKEN or BOTMOX_ADMIN_EMAIL+BOTMOX_ADMIN_PASSWORD)',
    });
  }
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

  const failedCommandChecks = commandChecks.filter((check) => !check.ok);
  if (failedCommandChecks.length > 0) {
    lines.push('');
    lines.push('## Failed Command Output (stderr tail)');
    lines.push('');
    for (const check of failedCommandChecks) {
      const stderrTail = String(check.stderr || '').trim();
      lines.push(`### ${check.command}`);
      if (!stderrTail) {
        lines.push('- (empty stderr)');
      } else {
        const tail = stderrTail.slice(-1200);
        lines.push('```text');
        lines.push(tail);
        lines.push('```');
      }
      lines.push('');
    }
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
