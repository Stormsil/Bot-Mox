#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const args = new Set(process.argv.slice(2));
const runLoad = args.has('--run-load');
const strict = args.has('--strict');

const repoRoot = process.cwd();
const now = new Date();
const dateIso = now.toISOString().slice(0, 10);
const timestampIso = now.toISOString();
const monthKey = dateIso.slice(0, 7);
const reportRelPath = path.join('docs', 'audits', `production-hardening-load-smoke-${monthKey}.md`);
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
const users = String(process.env.LOAD_USERS || '20').trim();
const iterations = String(process.env.LOAD_ITERATIONS || '25').trim();

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

function ensureReportFile(filePath) {
  if (fs.existsSync(filePath)) {
    return;
  }

  const initial = [
    '# Production Hardening Load Smoke',
    '',
    'Status: Active  ',
    'Owner: Platform Architecture  ',
    `Last Updated: ${dateIso}  `,
    'Applies To: `apps/backend`, `apps/frontend`',
    '',
    '## Purpose',
    '',
    'Operational evidence log for multi-tenant load smoke gates before and after rollout waves.',
    '',
    '## Entries',
    '',
    '| Timestamp (UTC) | Users | Iterations | AUTH_MODE | AGENT_TRANSPORT | SECRETS_VAULT_MODE | Status | Details |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
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

function extractFirstJsonObject(text) {
  const source = String(text || '');
  const start = source.indexOf('{');
  const end = source.lastIndexOf('}');
  if (start < 0 || end <= start) {
    return null;
  }
  const candidate = source.slice(start, end + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

function summarizeLoadResult(commandResult, preflightResult) {
  if (preflightResult && !preflightResult.ok) {
    return {
      status: 'fail',
      details: `strict preflight failed: ${preflightResult.command} (exit=${preflightResult.status ?? 'null'})`,
      metrics: null,
    };
  }

  if (!runLoad) {
    const preflightDetails = preflightResult ? 'strict preflight passed; ' : '';
    return {
      status: 'not-run',
      details: `${preflightDetails}load smoke not executed`,
      metrics: null,
    };
  }
  if (!commandResult.ok) {
    return {
      status: 'fail',
      details: `load smoke failed (exit=${commandResult.status ?? 'null'})`,
      metrics: null,
    };
  }

  const parsed = extractFirstJsonObject(commandResult.stdout);
  if (!parsed) {
    return { status: 'pass', details: 'load smoke passed (metrics parse skipped)', metrics: null };
  }

  const p99 = Number(parsed?.latency_ms?.p99_ms ?? 0);
  const rate5xx = Number(parsed?.rates?.status_5xx_rate ?? 0);
  const rate401 = Number(parsed?.rates?.status_401_rate ?? 0);
  const sseFailRate = Number(parsed?.rates?.sse_fail_rate ?? 0);
  const details = `p99=${p99}ms; 5xx=${(rate5xx * 100).toFixed(2)}%; 401=${(rate401 * 100).toFixed(2)}%; sse_fail=${(sseFailRate * 100).toFixed(2)}%`;
  return { status: 'pass', details, metrics: parsed };
}

const strictPreflightResult = strict ? runCommand('pnpm', ['run', 'migration:check:strict']) : null;
const canRunLoad = !strictPreflightResult || strictPreflightResult.ok;
const loadCommandResult =
  runLoad && canRunLoad
    ? runCommand('pnpm', ['run', 'smoke:load:multi-tenant'])
    : {
        ok: true,
        status: 0,
        stdout: '',
        stderr: '',
        command: runLoad
          ? 'pnpm run smoke:load:multi-tenant (skipped: strict preflight failed)'
          : '(not-run)',
      };

const summary = summarizeLoadResult(loadCommandResult, strictPreflightResult);
ensureReportFile(reportAbsPath);
let reportSource = fs.readFileSync(reportAbsPath, 'utf8');
reportSource = updateLastUpdated(reportSource);

const row = `| ${timestampIso} | ${users} | ${iterations} | ${authMode} | ${agentTransport} | ${vaultMode} | ${summary.status} | ${summary.details} |`;

if (!reportSource.endsWith('\n')) {
  reportSource += '\n';
}
reportSource += `${row}\n`;
fs.writeFileSync(reportAbsPath, reportSource, 'utf8');

process.stdout.write(`Load-smoke entry written: ${reportRelPath}\n`);
process.stdout.write(`Status: ${summary.status}\n`);

if (strictPreflightResult?.stderr) {
  process.stdout.write(`${strictPreflightResult.stderr}\n`);
}
if (loadCommandResult.stderr) {
  process.stdout.write(`${loadCommandResult.stderr}\n`);
}

if (strict && summary.status === 'fail') {
  process.exit(1);
}
